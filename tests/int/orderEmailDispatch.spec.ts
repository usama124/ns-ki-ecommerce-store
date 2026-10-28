// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
const mock = vi.hoisted(() => ({ ready: vi.fn(), claim: vi.fn(), update: vi.fn() }))
vi.mock('@/utilities/commerceDatabase', () => ({
  requireCommerceReady: mock.ready, COMMERCE: { outbox: 'test-email-outbox' },
}))
import { dispatchOrderEmails } from '@/utilities/orderOutbox'
const payload = {} as Payload
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('FROM_EMAIL', 'test@example.invalid')
  vi.stubEnv('ADMIN_EMAIL', 'admin@example.invalid')
  mock.ready.mockResolvedValue({ db: { collection: () => ({ findOneAndUpdate: mock.claim, updateOne: mock.update }) } })
  mock.claim.mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const job = () => ({ _id: 'email-1', lease: 'lease', kind: 'placed', customerEmail: 'customer@example.invalid', attempts: 1, firstAttemptAt: new Date(), subject: 'test', html: '<p>test</p>' })
describe('scoped email queue delivery', () => {
  it('claims only due, unsent jobs belonging to the committed checkout', async () => {
    await dispatchOrderEmails(payload, 2, 42)
    expect(mock.claim.mock.calls[0][0]).toEqual({
      orderId: '42', state: { $in: ['pending', 'processing'] }, availableAt: { $lte: expect.any(Date) },
    })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves unscoped administrator/worker queue dispatch', async () => {
    await dispatchOrderEmails(payload)
    expect(mock.claim.mock.calls[0][0]).not.toHaveProperty('orderId')
  })
  it('marks provider-accepted mail sent using the existing idempotency key and lease', async () => {
    mock.claim.mockResolvedValueOnce(job())
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'provider-1' })))
    expect(await dispatchOrderEmails(payload, 2, 'order-1')).toEqual({ sent: 1, retried: 0, dead: 0 })
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': 'nski-outbox-email-1' }),
    }))
    expect(mock.update).toHaveBeenLastCalledWith({ _id: 'email-1', lease: mock.claim.mock.calls[0][1][0].$set.lease }, expect.objectContaining({
      $set: expect.objectContaining({ state: 'sent', providerId: 'provider-1' }),
    }))
  })
  it.each(['timeout', 'rejected', 'invalid-response'])('keeps %s deliveries queued with backoff', async failure => {
    mock.claim.mockResolvedValueOnce(job())
    if (failure === 'timeout') vi.mocked(fetch).mockRejectedValue(new Error('timeout'))
    else vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: failure === 'rejected' ? 429 : 200 }))
    expect(await dispatchOrderEmails(payload, 2, 'order-1')).toEqual({ sent: 0, retried: 1, dead: 0 })
    expect(mock.update).toHaveBeenLastCalledWith({ _id: 'email-1', lease: mock.claim.mock.calls[0][1][0].$set.lease }, expect.objectContaining({
      $set: expect.objectContaining({ state: 'pending', failure: 'delivery_not_confirmed', availableAt: expect.any(Date) }),
    }))
  })
  it('never claims mail when provider configuration is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await expect(dispatchOrderEmails(payload, 2, 'order-1')).rejects.toMatchObject({ status: 503 })
    expect(mock.claim).not.toHaveBeenCalled()
  })
})
