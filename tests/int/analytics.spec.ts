import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  analyticsConfig,
  analyticsPage,
  cartItems,
  checkoutIntentEligible,
  checkoutItems,
  itemValue,
  productItem,
} from '@/lib/analytics/model'

describe('analytics configuration and privacy boundaries', () => {
  it('does not count invalid delivery/payment input as valid checkout intent', () => {
    const customer = {
      name: 'Synthetic QA',
      address: '123 Test Street',
      city: 'Lahore',
      province: 'Punjab',
      phone: '03001112222',
      email: 'qa@example.invalid',
    }
    expect(checkoutIntentEligible(customer, 'cod', '')).toBe(true)
    expect(checkoutIntentEligible(customer, 'bank_transfer', 'QA123456')).toBe(true)
    expect(checkoutIntentEligible(customer, 'bank_transfer', 'bad')).toBe(false)
    expect(checkoutIntentEligible({ ...customer, phone: 'abc' }, 'cod', '')).toBe(false)
    expect(checkoutIntentEligible({ ...customer, address: '<script>' }, 'cod', '')).toBe(false)
    expect(checkoutIntentEligible({ ...customer, name: ' ' }, 'cod', '')).toBe(false)
  })
  it('uses the latest server quote for a repeated checkout-intent submission', () => {
    const items = checkoutItems(
      [{ productId: '12', title: 'QA suit', variantSize: 'M', price: 1000, quantity: 2 }],
      [{ product: '12', variantSize: 'M', unitPrice: 1200, quantity: 2 }],
    )
    expect(itemValue(items)).toBe(2400)
    expect(items[0].price).toBe(1200)
  })
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_ANALYTICS_ENABLED: 'true',
    NEXT_PUBLIC_GA4_ID: 'G-TEST123',
    NEXT_PUBLIC_SERVER_URL: 'https://store.example',
  }
  it('requires explicit enablement, production runtime and the exact configured origin', () => {
    expect(analyticsConfig(env, 'https://store.example').enabled).toBe(true)
    for (const changes of [
      { NODE_ENV: 'test' },
      { NEXT_PUBLIC_ANALYTICS_ENABLED: 'false' },
      { NEXT_PUBLIC_VERCEL_ENV: 'preview' },
      { NEXT_PUBLIC_GA4_ID: 'invalid' },
      { NEXT_PUBLIC_SERVER_URL: 'bad' },
    ]) {
      expect(analyticsConfig({ ...env, ...changes }, 'https://store.example').enabled).toBe(false)
    }
    expect(analyticsConfig(env, 'http://localhost:3000').enabled).toBe(false)
    expect(analyticsConfig({}, 'https://store.example').enabled).toBe(false)
  })
  it.each([
    '/orders/private-id',
    '/account',
    '/login',
    '/track-order',
    '/find-order',
    '/checkout/confirm-order/private-number',
    '/store-admin',
    '/next/preview',
    '/api/orders',
  ])('excludes private route %s', (route) => {
    expect(analyticsPage(route)).toBeNull()
  })
  it('uses generic titles and public routes only', () => {
    expect(analyticsPage('/products/qa-suit')).toEqual({
      path: '/products/qa-suit',
      title: 'Product',
    })
    expect(analyticsPage('/shop/winter/')).toEqual({ path: '/shop/winter', title: 'Collection' })
    expect(analyticsPage('/checkout')).toEqual({ path: '/checkout', title: 'Checkout' })
  })
  it('uses stable product identity, actual sale price and safe quantity deltas', () => {
    const item = productItem(
      { id: 12, title: 'QA suit', basePricePKR: 1000, salePriceDetails: { effectivePrice: 800 } },
      'featured',
      2,
    )
    expect(item).toMatchObject({ item_id: '12', price: 800, item_list_id: 'featured', index: 2 })
    const lines = [{ productId: '12', title: 'QA suit', variantSize: 'M', price: 800, quantity: 2 }]
    expect(itemValue(cartItems(lines))).toBe(1600)
    expect(cartItems([{ ...lines[0], quantity: 1.5 }])).toEqual([])
    expect(productItem({ id: 1, basePricePKR: NaN })).toBeNull()
  })
})

describe('consented optional analytics transport', () => {
  let client: typeof import('@/lib/analytics/client')
  const config = { enabled: true, id: 'G-TEST123', origin: 'http://localhost:3000' }
  const line = { productId: '12', title: 'QA suit', variantSize: 'M', price: 800, quantity: 2 }
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    window.history.replaceState(
      null,
      '',
      '/shop?email=private%40example.invalid&token=private-token#private',
    )
    delete window.gtag
    delete window.dataLayer
    document.getElementById('nski-analytics-loader')?.remove()
    client = await import('@/lib/analytics/client')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('never loads Google before consent or queues denied shopping events', () => {
    client.startAnalytics(config)
    client.track('add_to_cart', cartItems([line]))
    client.chooseConsent('denied')
    client.startAnalytics(config)
    expect(document.getElementById('nski-analytics-loader')).toBeNull()
    expect(window.dataLayer).toBeUndefined()
  })
  it('loads once and sanitizes URLs/referrers/title and payload fields', () => {
    window.gtag = vi.fn()
    client.chooseConsent('granted')
    client.startAnalytics(config)
    client.startAnalytics(config)
    client.track(
      'view_cart',
      cartItems([{ ...line, email: 'private@example.invalid' } as typeof line]),
    )
    expect(document.querySelectorAll('#nski-analytics-loader')).toHaveLength(1)
    const calls = vi.mocked(window.gtag).mock.calls
    expect(calls.filter((call) => call[0] === 'config')).toHaveLength(1)
    expect(calls.find((call) => call[0] === 'config')?.[2]).toMatchObject({
      send_page_view: false,
      page_referrer: '',
    })
    const event = calls.find((call) => call[0] === 'event')
    expect(event?.[2]).toMatchObject({
      page_location: window.location.origin + '/shop',
      page_title: 'Shop',
      page_referrer: '',
      currency: 'PKR',
      value: 1600,
    })
    expect(JSON.stringify(calls)).not.toMatch(/private-token|private@example|email=|#private/)
    expect(
      (document.getElementById('nski-analytics-loader') as HTMLScriptElement).referrerPolicy,
    ).toBe('no-referrer')
  })
  it('sends added/removed quantity deltas exactly once per actual mutation', () => {
    window.gtag = vi.fn()
    client.chooseConsent('granted')
    client.startAnalytics(config)
    client.trackCartChange([line], [{ ...line, quantity: 3 }])
    client.trackCartChange([{ ...line, quantity: 3 }], [line])
    client.trackCartChange([line], [line])
    const events = vi.mocked(window.gtag).mock.calls.filter((call) => call[0] === 'event')
    expect(events.map((call) => call[1])).toEqual(['add_to_cart', 'remove_from_cart'])
    for (const event of events)
      expect(event[2]).toMatchObject({ value: 800, items: [{ quantity: 1 }] })
  })
  it('stops events immediately on revocation and excludes secure routes', () => {
    window.gtag = vi.fn()
    client.chooseConsent('granted')
    client.startAnalytics(config)
    client.chooseConsent('denied')
    client.track('view_cart', cartItems([line]))
    expect(client.analyticsReady()).toBe(false)
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-TEST123']).toBe(true)
    client.chooseConsent('granted')
    window.history.replaceState(null, '', '/orders/private-id?token=private-token')
    client.startAnalytics(config)
    client.track('view_cart', cartItems([line]))
    expect(vi.mocked(window.gtag).mock.calls.filter((call) => call[0] === 'event')).toHaveLength(0)
  })
  it('cannot throw through shopping when a third-party function breaks', () => {
    window.gtag = () => {
      throw new Error('blocked script')
    }
    client.chooseConsent('granted')
    expect(() => client.startAnalytics(config)).not.toThrow()
    expect(() => client.trackCartChange([], [line])).not.toThrow()
    expect(() => client.chooseConsent('denied')).not.toThrow()
  })
  it('supports session-only consent when storage writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    expect(() => client.chooseConsent('granted')).not.toThrow()
    expect(client.consentSnapshot()).toBe('granted')
  })
  it('captures GA callback IDs without customer data or parsing cookies', async () => {
    window.gtag = vi.fn((...args: unknown[]) => {
      if (args[0] === 'get')
        (args[3] as (value: string) => void)(args[2] === 'client_id' ? '123.456' : '1234567890')
    })
    client.chooseConsent('granted')
    client.startAnalytics(config)
    const result = await client.captureOrderAnalytics()
    expect(result).toMatchObject({
      consent: 'granted',
      clientId: '123.456',
      sessionId: '1234567890',
    })
    expect(result?.token).toMatch(/^[a-f0-9]{64}$/)
  })
  it('bounds blocked GA callbacks and skips IDs after consent withdrawal', async () => {
    window.gtag = vi.fn()
    client.chooseConsent('granted')
    client.startAnalytics(config)
    expect(await client.captureOrderAnalytics()).toBeUndefined()
    client.chooseConsent('denied')
    expect(await client.captureOrderAnalytics()).toBeUndefined()
  })
})
