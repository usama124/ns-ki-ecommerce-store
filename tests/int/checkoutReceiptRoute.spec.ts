// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ execute: vi.fn(), send: vi.fn(), getPayload: vi.fn(), parse: vi.fn(), read: vi.fn(), validate: vi.fn(), attach: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: vi.fn() }))
vi.mock('@/utilities/checkoutQuote', () => ({ parseCheckout: mock.parse }))
vi.mock('@/utilities/checkoutReceipt', () => ({ readCheckoutRequest: mock.read, validateCheckoutReceipt: mock.validate, attachCheckoutReceipt: mock.attach }))
vi.mock('@/utilities/checkoutCommand', () => ({ checkoutKey: () => 'same-key', executeCheckout: mock.execute }))
vi.mock('@/utilities/checkoutEmailDelivery', () => ({ sendCheckoutEmails: mock.send }))
import { POST } from '@/app/api/orders/route'
import { RequestError } from '@/utilities/apiSecurity'
const request = () => new Request('https://store.example/api/orders', { method: 'POST', headers: { Origin: 'https://store.example' } })
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: async () => ({ user: null }), config: { secret: 'test-secret' } })
  mock.parse.mockReturnValue({ paymentMethod: 'bank_transfer', customer: { phone: '03001234567' } })
  mock.read.mockResolvedValue({ body: { expectedTotal: 100 }, receipt: new File(['image'], 'receipt.png', { type: 'image/png' }) })
  mock.validate.mockResolvedValue(Buffer.from('validated-image'))
  mock.execute.mockResolvedValue({ orderId: 'order-1', orderNumber: '#NKI-123456', replayed: false })
})
describe('mandatory digital receipt API', () => {
  it.each(['bank_transfer', 'jazzcash', 'easypaisa'])('refuses %s checkout without a receipt before creating an order', async paymentMethod => {
    mock.parse.mockReturnValue({ paymentMethod, customer: { phone: '03001234567' } })
    mock.read.mockResolvedValue({ body: {}, receipt: null })
    expect((await POST(request())).status).toBe(400)
    expect(mock.execute).not.toHaveBeenCalled()
  })
  it('does not create an order when receipt decoding fails', async () => {
    mock.validate.mockRejectedValue(new RequestError('Invalid receipt image.'))
    expect((await POST(request())).status).toBe(400)
    expect(mock.execute).not.toHaveBeenCalled()
  })
  it('returns success only after receipt attachment is confirmed', async () => {
    mock.attach.mockImplementation(async () => expect(mock.execute).toHaveBeenCalledOnce())
    expect((await POST(request())).status).toBe(200)
    expect(mock.attach).toHaveBeenCalledExactlyOnceWith('order-1', Buffer.from('validated-image'))
  })
  it('exempts COD and does not invoke private storage', async () => {
    mock.parse.mockReturnValue({ paymentMethod: 'cod', customer: { phone: '03001234567' } })
    mock.read.mockResolvedValue({ body: {}, receipt: null })
    expect((await POST(request())).status).toBe(200)
    expect(mock.validate).not.toHaveBeenCalled()
    expect(mock.attach).not.toHaveBeenCalled()
  })
  it('returns a recoverable saved-order result, not success, when storage fails after commit', async () => {
    mock.attach.mockRejectedValue(new Error('private storage details'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    const result = await response.json()
    expect(result).toMatchObject({ success: false, code: 'RECEIPT_UPLOAD_PENDING', orderId: 'order-1', accessToken: expect.any(String) })
    expect(JSON.stringify(result)).not.toContain('private storage details')
  })
  it('does not store proof when a price change requires customer approval', async () => {
    mock.execute.mockResolvedValue({ quote: { totalAmount: 200 } })
    expect((await POST(request())).status).toBe(409)
    expect(mock.attach).not.toHaveBeenCalled()
  })
})
