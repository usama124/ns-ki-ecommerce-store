import { analyticsConfig, analyticsPage, cartItems, itemValue, type AnalyticsItem } from './model'
import { parseAnalyticsContext } from './context'

type Consent = 'unknown' | 'granted' | 'denied'
type EventName =
  | 'page_view'
  | 'view_item_list'
  | 'select_item'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}
const KEY = 'nski_analytics_consent_v1'
const GRANT = 'nski_analytics_grant_v1'
const REVOKE = 'nski_analytics_revoke_v1'
let grantToken: string | undefined
function consentToken() {
  try {
    // Do not create a second server grant while an older withdrawal is offline.
    if (localStorage.getItem(REVOKE)) return undefined
    grantToken = localStorage.getItem(GRANT) || grantToken
    if (!grantToken) {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      grantToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    // Server attribution needs a durable withdrawal capability, even when a
    // previous call generated a memory token before storage became unavailable.
    localStorage.setItem(GRANT, grantToken)
    return grantToken
  } catch {
    return undefined
  }
}
/** Best effort; retained for retry on the next visit if offline. Not a deletion request. */
export async function syncAnalyticsRevocation() {
  try {
    const token = localStorage.getItem(REVOKE)
    if (!token) return
    const result = await fetch('/api/analytics/revoke', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(3000),
    })
    if (result.ok && localStorage.getItem(REVOKE) === token) localStorage.removeItem(REVOKE)
  } catch {
    /* Retry next visit. Shopping never depends on this request. */
  }
}
let consent: Consent | undefined
let ready = false
let configuredID = ''
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
export function subscribeAnalytics(listener: () => void) {
  listeners.add(listener)
  const changed = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return
    consent = undefined
    grantToken = undefined
    notify()
  }
  window.addEventListener('storage', changed)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', changed)
  }
}
export function consentSnapshot(): Consent {
  if (typeof window === 'undefined') return 'unknown'
  if (consent !== undefined) return consent
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    consent =
      saved && ['granted', 'denied'].includes(saved.value) && saved.expires > Date.now()
        ? saved.value
        : 'unknown'
  } catch {
    consent = 'unknown'
  }
  return consent!
}
export function chooseConsent(value: Exclude<Consent, 'unknown'>) {
  consent = value
  try {
    localStorage.setItem(KEY, JSON.stringify({ value, expires: Date.now() + 180 * 86400000 }))
  } catch {
    /* Session-only consent. */
  }
  if (value === 'denied') {
    try {
      const token = localStorage.getItem(GRANT) || grantToken
      if (token) localStorage.setItem(REVOKE, token)
      localStorage.removeItem(GRANT)
    } catch {
      /* Local persistence may be unavailable. */
    }
    grantToken = undefined
    void syncAnalyticsRevocation()
    if (window.dataLayer) window.dataLayer.length = 0
    stopAnalytics()
  }
  notify()
}
/** Bounded GA get callbacks, never cookie parsing, synthesized IDs, or checkout failure. */
export async function captureOrderAnalytics() {
  try {
    if (!analyticsReady() || !configuredID) return
    const token = consentToken()
    if (!token) return
    const values = await Promise.race([
      Promise.all(
        ['client_id', 'session_id'].map(
          (field) =>
            new Promise<unknown>((resolve) => {
              window.gtag?.('get', configuredID, field, resolve)
            }),
        ),
      ),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 300)),
    ])
    if (!analyticsReady() || !values || token !== consentToken()) return
    return parseAnalyticsContext({
      consent: 'granted',
      token,
      clientId: values[0],
      sessionId: String(values[1]),
    })
  } catch {
    return undefined
  }
}
export function browserAnalyticsConfig() {
  return analyticsConfig(
    {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
      NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
      NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
      NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    },
    typeof window === 'undefined' ? '' : window.location.origin,
  )
}
export function analyticsReady() {
  return (
    ready && consentSnapshot() === 'granted' && Boolean(analyticsPage(window.location.pathname))
  )
}
export function stopAnalytics() {
  ready = false
  if (configuredID)
    (window as unknown as Record<string, unknown>)[`ga-disable-${configuredID}`] = true
  try {
    window.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
  } catch {
    /* Blocked/broken third-party scripts are optional. */
  }
  notify()
}
/** Basic opt-in: no Google loader/request before consent; no denied-event replay. */
export function startAnalytics(config = browserAnalyticsConfig()) {
  try {
    if (
      !config.enabled ||
      consentSnapshot() !== 'granted' ||
      !analyticsPage(window.location.pathname)
    ) {
      stopAnalytics()
      return
    }
    const page = analyticsPage(window.location.pathname)!
    configuredID = config.id
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${config.id}`] = false
    window.dataLayer ||= []
    // Google's command queue intentionally uses an Arguments object.
    window.gtag ||= function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    if (!document.getElementById('nski-analytics-loader'))
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      })
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    window.gtag('set', {
      page_location: config.origin + page.path,
      page_title: page.title,
      page_referrer: '',
    })
    if (!document.getElementById('nski-analytics-loader')) {
      window.gtag('js', new Date())
      window.gtag('config', config.id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: config.origin + page.path,
        page_title: page.title,
        page_referrer: '',
      })
      const script = document.createElement('script')
      script.id = 'nski-analytics-loader'
      script.async = true
      script.referrerPolicy = 'no-referrer'
      script.src = `https://www.googletagmanager.com/gtag/js?id=${config.id}`
      document.head.appendChild(script)
    }
    ready = true
    notify()
  } catch {
    ready = false
    notify()
  }
}
export function track(
  name: EventName,
  items: AnalyticsItem[] = [],
  extra: { payment_type?: string; shipping_tier?: string } = {},
) {
  try {
    if (!analyticsReady()) return
    const page = analyticsPage(window.location.pathname)!
    // Reconstruct allowlisted payloads, never spread products/customer/API responses.
    const safeItems = items.slice(0, 50).map((item) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      item_brand: item.item_brand,
      price: item.price,
      quantity: item.quantity,
      ...(item.item_category ? { item_category: item.item_category } : {}),
      ...(item.item_variant ? { item_variant: item.item_variant } : {}),
      ...(item.item_list_id ? { item_list_id: item.item_list_id } : {}),
      ...(item.index === undefined ? {} : { index: item.index }),
    }))
    window.gtag?.('event', name, {
      page_location: window.location.origin + page.path,
      page_title: page.title,
      page_referrer: '',
      ...(safeItems.length
        ? { currency: 'PKR', value: itemValue(safeItems), items: safeItems }
        : {}),
      ...(['cod', 'bank_transfer', 'jazzcash', 'easypaisa'].includes(extra.payment_type || '')
        ? { payment_type: extra.payment_type }
        : {}),
      ...(extra.shipping_tier === 'major_city' || extra.shipping_tier === 'secondary_city'
        ? { shipping_tier: extra.shipping_tier }
        : {}),
    })
  } catch {
    /* Analytics must never interrupt a shopping action. */
  }
}
export function trackCartChange(
  before: Parameters<typeof cartItems>[0],
  after: Parameters<typeof cartItems>[0],
) {
  const key = (item: (typeof before)[number]) => `${item.productId}:${item.variantSize}`
  const previous = new Map(before.map((item) => [key(item), item]))
  const next = new Map(after.map((item) => [key(item), item]))
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const old = previous.get(id),
      current = next.get(id)
    const delta = (current?.quantity || 0) - (old?.quantity || 0)
    if (delta)
      track(
        delta > 0 ? 'add_to_cart' : 'remove_from_cart',
        cartItems([{ ...(delta > 0 ? current! : old!), quantity: Math.abs(delta) }]),
      )
  }
}
