import { describe, expect, it, beforeEach, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  findByID: vi.fn(),
  notFound: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ notFound: mock.notFound }))
import OrderPage from '@/app/(app)/(account)/orders/[id]/page'
import { signOrderAccess } from '@/utilities/orderAccess'

beforeEach(() => {
  vi.resetAllMocks()
  mock.notFound.mockImplementation(() => {
    throw new Error('NOT_FOUND')
  })
  mock.getPayload.mockResolvedValue({ ...mock, config: { secret: 'test-secret' } })
  mock.auth.mockResolvedValue({ user: null })
  mock.findByID.mockResolvedValue({
    id: 'order-a',
    createdAt: '2026-01-01',
    customer: {},
    items: [],
    totalAmount: 100,
  })
})
describe('Order page authorization', () => {
  it('denies guests without a valid scoped capability before fetching any order', async () => {
    for (const token of [undefined, 'forged', signOrderAccess('order-b', 'test-secret')]) {
      await expect(
        OrderPage({
          params: Promise.resolve({ id: 'order-a' }),
          searchParams: Promise.resolve({ token }),
        }),
      ).rejects.toThrow('NOT_FOUND')
    }
    expect(mock.findByID).not.toHaveBeenCalled()
  })
  it('allows a signed guest link but only fetches the customer-visible projection', async () => {
    await OrderPage({
      params: Promise.resolve({ id: 'order-a' }),
      searchParams: Promise.resolve({ token: signOrderAccess('order-a', 'test-secret') }),
    })
    const [options] = mock.findByID.mock.calls[0]
    expect(options).toMatchObject({ id: 'order-a', overrideAccess: true })
    expect(options.select.notes).toBeUndefined()
    expect(options.select.paymentProof).toBeUndefined()
  })
  it('enforces owner/admin access for ordinary logged-in requests instead of trusting the URL ID', async () => {
    const user = { id: 'customer-a', roles: ['customer'] }
    mock.auth.mockResolvedValue({ user })
    await OrderPage({
      params: Promise.resolve({ id: 'order-a' }),
      searchParams: Promise.resolve({}),
    })
    expect(mock.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ user, overrideAccess: false }),
    )
    mock.findByID.mockRejectedValue(new Error('Forbidden'))
    await expect(
      OrderPage({ params: Promise.resolve({ id: 'order-b' }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NOT_FOUND')
  })
})
