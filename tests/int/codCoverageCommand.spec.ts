// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ coverage: vi.fn(), quote: vi.fn(), create: vi.fn(), read: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('@/utilities/instaworldCities', () => ({ getCodCoverage: mock.coverage }))
vi.mock('@/utilities/checkoutQuote', () => ({ quoteCheckout: mock.quote }))
vi.mock('@/utilities/commerceDatabase', () => ({
  COMMERCE: { checkout: 'test-checkout' }, commerceSession: async () => ({}),
  commerceTransaction: async (_payload: unknown, _user: unknown, work: (req: unknown) => unknown) => work({ context: {} }),
  mongoCommerce: () => ({ db: { collection: () => ({ findOne: mock.read, insertOne: mock.insert, updateOne: mock.update }) } }),
}))
import { executeCheckout } from '@/utilities/checkoutCommand'
let previous: Record<string, unknown> | null
const input = () => ({ customer: { name: 'Test', phone: '03001234567', email: '', city: 'Lahore', province: 'Punjab', address: 'Street 1' }, paymentMethod: 'cod' as const, lines: [{ productId: 'p1', variantSize: 'M', quantity: 1 }], paymentProof: undefined })
const payload = { config: { secret: 'test-only-secret' }, create: mock.create } as never
beforeEach(() => {
  vi.resetAllMocks(); previous = null
  mock.coverage.mockResolvedValue({ cities: [{ name: 'LAHORE', province: 'Punjab', label: 'Lahore' }], checkedAt: new Date().toISOString() })
  mock.quote.mockResolvedValue({ totalAmount: 1250, subtotal: 1000, shippingFee: 250, codFee: 0, items: [] })
  mock.create.mockResolvedValue({ id: 'order-1', orderNumber: '#NKI-123456' })
  mock.read.mockImplementation(async () => previous)
  mock.insert.mockImplementation(async doc => { previous = { ...doc } })
  mock.update.mockImplementation(async (_filter, update) => Object.assign(previous!, update.$set))
})
describe('server-authoritative COD coverage', () => {
  it('accepts supported province/city pairs without changing the existing input identity', async () => {
    expect(await executeCheckout(payload, input(), 1250, 'key')).toMatchObject({ orderId: 'order-1' })
    expect(mock.create.mock.calls[0][0].data.customer.city).toBe('Lahore')
  })
  it('rejects tampered/unsupported cities before order and stock mutation', async () => {
    await expect(executeCheckout(payload, { ...input(), customer: { ...input().customer, city: 'Unsupported town' } }, 1250, 'key')).rejects.toMatchObject({ status: 400 })
    await expect(executeCheckout(payload, { ...input(), customer: { ...input().customer, province: 'Sindh' } }, 1250, 'key')).rejects.toMatchObject({ status: 400 })
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.quote).not.toHaveBeenCalled()
  })
  it('blocks new COD orders when coverage is unavailable', async () => {
    mock.coverage.mockRejectedValue(new Error('offline'))
    await expect(executeCheckout(payload, input(), 1250, 'key')).rejects.toMatchObject({ status: 503 })
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('preserves committed retry replay during coverage outages without creating another order', async () => {
    await executeCheckout(payload, input(), 1250, 'key')
    mock.coverage.mockRejectedValue(new Error('offline'))
    expect(await executeCheckout(payload, input(), 1250, 'key')).toMatchObject({ orderId: 'order-1', replayed: true })
    expect(mock.create).toHaveBeenCalledOnce()
  })
  it('does not call the COD city API for prepaid checkout', async () => {
    await executeCheckout(payload, { ...input(), paymentMethod: 'bank_transfer' }, 1250, 'key')
    expect(mock.coverage).not.toHaveBeenCalled()
    expect(mock.create).toHaveBeenCalledOnce()
  })
})
