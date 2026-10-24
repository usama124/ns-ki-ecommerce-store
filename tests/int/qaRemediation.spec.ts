import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireSameOrigin } from '@/utilities/apiSecurity'
import { orderAmounts } from '@/utilities/orderAmounts'
import { parseStoredCart } from '@/utilities/cartStorage'
import { safeRedirect } from '@/utilities/safeRedirect'

afterEach(() => vi.unstubAllEnvs())
describe('trusted origin behind reverse proxies', () => {
  it('accepts configured public origin despite internal bind host', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
    expect(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/orders', { headers: { origin: 'https://store.example' } }))).not.toThrow()
  })
  it.each(['https://evil.invalid', 'null', 'http://0.0.0.0:3000'])('rejects %s even with a spoofed forwarding header', origin => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
    expect(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/orders', { headers: { origin, 'x-forwarded-host': 'evil.invalid' } }))).toThrow()
  })
  it('rejects cross-site requests and malformed configured origins', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
    expect(() => requireSameOrigin(new Request('https://store.example', { headers: { origin: 'https://store.example', 'sec-fetch-site': 'cross-site' } }))).toThrow()
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'not-a-url')
    expect(() => requireSameOrigin(new Request('https://store.example'))).toThrow()
  })
})

describe('order financial invariants', () => {
  const order = { items: [{ quantity: 1, unitPrice: 1000 }], shippingFee: 250, codFee: 100, paymentMethod: 'cod' }
  it('recalculates edited quantities with accepted price and fee snapshots', () => {
    expect(orderAmounts({ items: [{ quantity: 3, unitPrice: 1000 }] }, order)).toEqual({ subtotal: 3000, shippingFee: 250, codFee: 100, totalAmount: 3350 })
  })
  it('drops COD fees for digital methods and accepts zero-priced items', () => {
    expect(orderAmounts({ ...order, paymentMethod: 'bank_transfer' }).totalAmount).toBe(1250)
    expect(orderAmounts({ ...order, items: [{ quantity: 1, unitPrice: 0 }] }).subtotal).toBe(0)
  })
  it.each([-1, 1.5, NaN, Infinity, 100000001])('rejects unsafe unit price %s', price => {
    expect(() => orderAmounts({ ...order, items: [{ quantity: 1, unitPrice: price }] })).toThrow()
  })
  it.each([0, -1, 1.5, 100, Infinity])('rejects invalid quantity %s', quantity => {
    expect(() => orderAmounts({ ...order, items: [{ quantity, unitPrice: 1000 }] })).toThrow()
  })
  it('rejects empty items and overflow; validates fees', () => {
    expect(() => orderAmounts({ ...order, items: [] })).toThrow()
    expect(() => orderAmounts({ ...order, items: [{ quantity: 99, unitPrice: 100000000 }] })).toThrow()
    expect(() => orderAmounts({ ...order, shippingFee: -1 })).toThrow()
  })
})
describe('safe post-authentication navigation', () => {
  it.each(['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', 'javascript:alert(1)', '/%2fevil.invalid', '/%252fevil.invalid', '/%0aevil', '/%zz'])('rejects %s', value => {
    expect(safeRedirect(value)).toBe('/account')
  })
  it('preserves safe order paths including signed-token query without decoding it', () => {
    expect(safeRedirect('/orders/123?token=synthetic%2Btoken#details')).toBe('/orders/123?token=synthetic%2Btoken#details')
    expect(safeRedirect(null, '/account?success=created')).toBe('/account?success=created')
  })
})
describe('untrusted stored cart', () => {
  const item = { productId: '123', slug: 'qa-suit', title: 'QA suit', variantSize: 'M', quantity: 1, price: 1000 }
  it.each(['{}', 'null', '"text"', '[null]', '[1]', '{', ''])('recovers from %s', stored => {
    expect(parseStoredCart(stored)).toEqual([])
  })
  it('retains valid items and discards invalid rows without crashing', () => {
    expect(parseStoredCart(JSON.stringify([item, { ...item, quantity: 1.5 }, { ...item, price: -1 }, { ...item, stock: '100' }]))).toEqual([item])
  })
  it('bounds persisted cart size', () => {
    expect(parseStoredCart(JSON.stringify(Array(51).fill(item)))).toEqual([])
  })
})
