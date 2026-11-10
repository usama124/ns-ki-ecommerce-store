// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ exists: vi.fn(), store: vi.fn(), decode: vi.fn(), destroy: vi.fn() }))
vi.mock('@/utilities/privateReceipts', () => ({
  RECEIPT_MAX_BYTES: 3 * 1024 * 1024,
  receiptExists: mock.exists, storeReceipt: mock.store, readReceipt: mock.decode,
  receiptStorage: () => ({ client: { destroy: mock.destroy } }),
}))
import { readCheckoutRequest, validateCheckoutReceipt, attachCheckoutReceipt } from '@/utilities/checkoutReceipt'
import { RequestError } from '@/utilities/apiSecurity'
const request = (form: FormData) => new Request('https://store.example/api/orders', { method: 'POST', body: form })
const form = () => {
  const value = new FormData()
  value.set('checkout', JSON.stringify({ paymentMethod: 'bank_transfer' }))
  value.set('receipt', new File(['image'], 'receipt.png', { type: 'image/png' }))
  return value
}
beforeEach(() => { vi.resetAllMocks(); mock.exists.mockResolvedValue(false) })
describe('bounded private checkout receipt', () => {
  it('reads JSON for COD compatibility but does not invent receipt proof', async () => {
    expect(await readCheckoutRequest(new Request('https://store.example', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"paymentMethod":"cod"}' }))).toEqual({ body: { paymentMethod: 'cod' }, receipt: null })
  })
  it('reads a multipart receipt and structured checkout', async () => {
    const result = await readCheckoutRequest(request(form()))
    expect(result.body.paymentMethod).toBe('bank_transfer')
    expect(result.receipt?.type).toBe('image/png')
  })
  it.each(['missing', 'duplicate', 'invalid-json', 'array-json', 'text-file', 'extra'])('rejects %s multipart fields', async mode => {
    const value = form()
    if (mode === 'missing') value.delete('receipt')
    if (mode === 'duplicate') value.append('receipt', new File(['other'], 'other.png'))
    if (mode === 'invalid-json') value.set('checkout', '{')
    if (mode === 'array-json') value.set('checkout', '[]')
    if (mode === 'text-file') value.set('receipt', 'not a file')
    if (mode === 'extra') value.set('extra', 'unexpected')
    await expect(readCheckoutRequest(request(value))).rejects.toMatchObject({ status: 400 })
  })
  it('bounds actual streamed bytes without trusting Content-Length', async () => {
    const value = form()
    value.set('receipt', new File([new Uint8Array(4 * 1024 * 1024)], 'large.png'))
    await expect(readCheckoutRequest(request(value))).rejects.toMatchObject({ status: 413 })
  })
  it('validates using the existing private image decoder', async () => {
    mock.decode.mockResolvedValue(Buffer.from('webp'))
    expect(await validateCheckoutReceipt(new File(['image'], 'proof.png', { type: 'image/png' }))).toEqual(Buffer.from('webp'))
    expect(mock.destroy).toHaveBeenCalledOnce()
    const req = mock.decode.mock.calls[0][0] as Request
    expect(req.headers.get('content-type')).toBe('image/png')
    expect(await req.text()).toBe('image')
  })
  it('never overwrites an existing receipt on an idempotent retry', async () => {
    mock.exists.mockResolvedValue(true)
    await attachCheckoutReceipt('order-1', Buffer.from('image'))
    expect(mock.store).not.toHaveBeenCalled()
  })
  it('accepts a concurrent successful conditional upload but does not hide storage failures', async () => {
    mock.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    mock.store.mockRejectedValueOnce(new RequestError('Already attached', 409))
    await expect(attachCheckoutReceipt('order-1', Buffer.from('image'))).resolves.toBeUndefined()
    mock.exists.mockResolvedValue(false)
    mock.store.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(attachCheckoutReceipt('order-1', Buffer.from('image'))).rejects.toThrow('storage unavailable')
  })
})
