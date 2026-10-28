export type AnalyticsItem = {
  item_id: string
  item_name: string
  item_brand: string
  item_category?: string
  item_variant?: string
  item_list_id?: string
  index?: number
  price: number
  quantity: number
}
type Product = {
  id?: unknown
  title?: unknown
  basePricePKR?: unknown
  primaryCategory?: unknown
  salePriceDetails?: { effectivePrice?: number }
}
type CartLine = {
  productId: string
  title: string
  variantSize: string
  variantColor?: string
  price: number
  quantity: number
}
const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 100) : '')
export function productItem(product: Product, list?: string, index?: number): AnalyticsItem | null {
  const id =
    typeof product.id === 'string' || typeof product.id === 'number' ? String(product.id) : ''
  const price = product.salePriceDetails?.effectivePrice ?? product.basePricePKR
  if (!id || typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null
  const category =
    product.primaryCategory &&
    typeof product.primaryCategory === 'object' &&
    'name' in product.primaryCategory
      ? text(product.primaryCategory.name)
      : ''
  return {
    item_id: id,
    item_name: text(product.title),
    item_brand: "Siblings by N's KI",
    price,
    quantity: 1,
    ...(category ? { item_category: category } : {}),
    ...(list ? { item_list_id: text(list) } : {}),
    ...(index === undefined ? {} : { index }),
  }
}
export function cartItems(lines: CartLine[]): AnalyticsItem[] {
  return lines
    .flatMap((line) => {
      const item = productItem({ id: line.productId, title: line.title, basePricePKR: line.price })
      return item && Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99
        ? [
            {
              ...item,
              quantity: line.quantity,
              item_variant: text([line.variantSize, line.variantColor].filter(Boolean).join(' / ')),
            },
          ]
        : []
    })
    .slice(0, 50)
}
export function itemValue(items: AnalyticsItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

export function checkoutItems(
  lines: CartLine[],
  quote?: { product: string | number; variantSize: string; quantity: number; unitPrice: number }[],
) {
  return cartItems(
    lines.map((line) => {
      const revised = quote?.find(
        (item) =>
          String(item.product) === line.productId &&
          item.variantSize.toLowerCase() === line.variantSize.toLowerCase(),
      )
      return revised ? { ...line, quantity: revised.quantity, price: revised.unitPrice } : line
    }),
  )
}

export function checkoutIntentEligible(
  customer: {
    name: string
    address: string
    city: string
    province: string
    phone: string
    email: string
  },
  method: string,
  reference: string,
) {
  if (!['cod', 'bank_transfer', 'jazzcash', 'easypaisa'].includes(method)) return false
  for (const [value, max] of [
    [customer.name, 120],
    [customer.address, 500],
    [customer.city, 100],
    [customer.province, 100],
  ] as const) {
    if (!value.trim() || value.length > max || /[\u0000-\u001f<>]/.test(value)) return false
  }
  return (
    /^\+?\d[\d ()-]{8,19}$/.test(customer.phone) &&
    /^\d{10,15}$/.test(customer.phone.replace(/\D/g, '')) &&
    customer.email.length <= 254 &&
    (!customer.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) &&
    (method === 'cod' || /^[A-Za-z0-9]{6,18}$/.test(reference.replace(/[^A-Za-z0-9]/g, '')))
  )
}

/** Never send contact queries, secure order IDs/tokens, document titles or referrers. */
export function analyticsPage(path: string) {
  if (path === '/') return { path: '/', title: 'Store home' }
  if (path === '/checkout') return { path, title: 'Checkout' }
  if (path === '/shop' || path === '/sale')
    return { path, title: path === '/shop' ? 'Shop' : 'Sale' }
  if (/^\/(products|shop)\/[a-zA-Z0-9_-]+\/?$/.test(path))
    return {
      path: path.replace(/\/$/, ''),
      title: path.startsWith('/products/') ? 'Product' : 'Collection',
    }
  return null
}

export function analyticsConfig(env: Record<string, string | undefined>, origin: string) {
  const id = env.NEXT_PUBLIC_GA4_ID || ''
  let enabled = false
  try {
    const url = new URL(origin)
    const local =
      ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) ||
      url.hostname.endsWith('.localhost')
    enabled =
      env.NODE_ENV === 'production' &&
      env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' &&
      !local &&
      url.protocol === 'https:' &&
      (!env.NEXT_PUBLIC_VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV === 'production') &&
      new URL(env.NEXT_PUBLIC_SERVER_URL || '').origin === origin &&
      /^G-[A-Z0-9]+$/.test(id)
  } catch {
    /* Missing configuration disables analytics, never the store. */
  }
  return { enabled, id, origin }
}
