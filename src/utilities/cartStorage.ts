import type { CartItem } from '@/providers/Cart'

/** Persisted browser data is untrusted and may come from an older/broken client. */
export function parseStoredCart(stored: string | null): CartItem[] {
  try {
    const value: unknown = stored ? JSON.parse(stored) : []
    if (!Array.isArray(value) || value.length > 50) return []
    return value.filter((item): item is CartItem => {
      if (!item || typeof item !== 'object') return false
      const text = (key: string) => typeof item[key] === 'string' && item[key].length > 0 && item[key].length <= 500
      return text('productId') && text('slug') && text('title') && text('variantSize') &&
        Number.isSafeInteger(item.price) && item.price >= 0 && item.price <= 100_000_000 &&
        Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99 &&
        (item.stock === undefined || (Number.isSafeInteger(item.stock) && item.stock >= 0)) &&
        (item.allowBackorder === undefined || typeof item.allowBackorder === 'boolean') &&
        ['variantColor', 'variantSku', 'imageUrl'].every(key => item[key] === undefined || typeof item[key] === 'string')
    })
  } catch { return [] }
}
