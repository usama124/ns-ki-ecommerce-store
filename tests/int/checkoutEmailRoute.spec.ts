// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ execute: vi.fn(), send: vi.fn(), getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: vi.fn() }))
vi.mock('@/utilities/checkoutQuote', () => ({ parseCheckout: () => ({ customer: { phone: '03001234567' } }) }))
vi.mock('@/utilities/checkoutCommand', () => ({ checkoutKey: () => 'key', executeCheckout: mock.execute }))
vi.mock('@/utilities/checkoutEmailDelivery', () => ({ sendCheckoutEmails: mock.send }))
import { POST } from '@/app/api/orders/route'
const payload = { auth: vi.fn(), config: { secret: 'unit-test-secret' } }
const request = () => new Request('https://store.example/api/orders', {
  method: 'POST', headers: { Origin: 'https://store.example', 'Content-Type': 'application/json' }, body: '{}',
})
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue(payload)
  payload.auth.mockResolvedValue({ user: null })
})
describe('post-commit checkout email trigger', () => {
  it.each([false, true])('attempts only after a committed result, including replay=%s', async replayed => {
    mock.execute.mockImplementation(async () => {
      expect(mock.send).not.toHaveBeenCalled()
      return { orderId: 'order-1', orderNumber: '#NKI-123456', replayed }
    })
    expect((await POST(request())).status).toBe(200)
    expect(mock.send).toHaveBeenCalledExactlyOnceWith(payload, 'order-1')
  })
  it('does not attempt delivery for a quote change', async () => {
    mock.execute.mockResolvedValue({ quote: { totalAmount: 100 } })
    expect((await POST(request())).status).toBe(409)
    expect(mock.send).not.toHaveBeenCalled()
  })
  it('does not attempt delivery for a failed/rolled-back checkout', async () => {
    mock.execute.mockRejectedValue(new Error('transaction failed'))
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(request())).status).toBe(503)
    expect(mock.send).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
