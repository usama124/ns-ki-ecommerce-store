// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAnalyticsContext } from '@/lib/analytics/context'
import {
  orderAnalyticsEvent,
  serverAnalyticsEnabled,
  dispatchOrderAnalytics,
} from '@/utilities/orderAnalytics'

const context = {
  consent: 'granted',
  clientId: '123456.789012',
  sessionId: '1234567890',
  token: 'a'.repeat(64),
}
afterEach(() => vi.unstubAllEnvs())
describe('server analytics privacy and truth boundaries', () => {
  it('reconstructs only the consent/GA identity capability allowlist', () => {
    expect(
      parseAnalyticsContext({ ...context, email: 'private@example.invalid', total: 1 }),
    ).toEqual(context)
  })
  it.each([
    null,
    {},
    { ...context, consent: 'denied' },
    { ...context, token: 'guess' },
    { ...context, clientId: 'email@example.invalid' },
    { ...context, sessionId: '-1' },
    { ...context, sessionId: 'bad' },
    { ...context, token: 'A'.repeat(64) },
  ])('rejects invalid or unconsented context %#', (value) => {
    expect(parseAnalyticsContext(value)).toBeUndefined()
  })
  const order = {
    id: 42,
    paymentMethod: 'cod',
    shippingFee: 250,
    codFee: 100,
    customer: { name: 'Secret buyer', email: 'private@example.invalid', phone: '03000000000' },
    paymentProof: { transactionId: 'SECRET-REFERENCE' },
    notes: 'Secret internal notes',
    totalAmount: 9999999,
    items: [{ product: 7, variantSize: 'M', unitPrice: 800, quantity: 2 }],
  }
  it('measures trusted merchandise value separately from shipping and COD fees', () => {
    const event = orderAnalyticsEvent(order as never, 'purchase')
    expect(event).toMatchObject({
      name: 'purchase',
      params: {
        transaction_id: '42',
        value: 1600,
        shipping: 250,
        cod_fee: 100,
        payment_status: 'cod_due',
        items: [{ item_id: '7', price: 800, quantity: 2 }],
      },
    })
    expect(JSON.stringify(event)).not.toMatch(/Secret|private@|030000|REFERENCE|9999999/)
  })
  it('does not label an unverified transfer as collected revenue', () => {
    const doc = { ...order, paymentMethod: 'jazzcash' } as never
    expect(orderAnalyticsEvent(doc, 'order_placed')?.params.payment_status).toBe('transfer_pending')
    expect(orderAnalyticsEvent(doc, 'purchase')?.params.payment_status).toBe('transfer_confirmed')
  })
  it.each(
    [
      [],
      [{ product: 7, quantity: 1, unitPrice: -1 }],
      [{ product: 7, quantity: 0, unitPrice: 1 }],
    ].map((items) => ({ items })),
  )('skips malformed financial snapshots %#', ({ items }) => {
    expect(orderAnalyticsEvent({ ...order, items } as never, 'purchase')).toBeUndefined()
  })
  it('requires independent server opt-in and production-only browser configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_GA4_ID', 'G-TEST123')
    vi.stubEnv('ANALYTICS_SERVER_ENABLED', 'false')
    expect(serverAnalyticsEnabled()).toBe(false)
    await expect(dispatchOrderAnalytics({} as never)).rejects.toThrow('disabled')
    vi.stubEnv('ANALYTICS_SERVER_ENABLED', 'true')
    expect(serverAnalyticsEnabled()).toBe(true)
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(serverAnalyticsEnabled()).toBe(false)
  })
})
