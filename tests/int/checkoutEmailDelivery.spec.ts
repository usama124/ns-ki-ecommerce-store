// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const mock = vi.hoisted(() => ({ after: vi.fn(), dispatch: vi.fn() }))
vi.mock('next/server', async importOriginal => ({
  ...await importOriginal<typeof import('next/server')>(), after: mock.after,
}))
vi.mock('@/utilities/orderOutbox', () => ({ dispatchOrderEmails: mock.dispatch }))
import { sendCheckoutEmails } from '@/utilities/checkoutEmailDelivery'

const payload = {} as Payload
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('automatic checkout email delivery', () => {
  it('registers lifecycle-managed work without blocking the checkout response', async () => {
    sendCheckoutEmails(payload, 'order-1')
    expect(mock.after).toHaveBeenCalledOnce()
    expect(mock.dispatch).not.toHaveBeenCalled()
    await mock.after.mock.calls[0][0]()
    expect(mock.dispatch).toHaveBeenCalledExactlyOnceWith(payload, 2, 'order-1')
  })
  it('does not bypass the queue to retry a provider failure', async () => {
    mock.dispatch.mockResolvedValue({ sent: 1, retried: 1, dead: 0 })
    sendCheckoutEmails(payload, 42)
    await mock.after.mock.calls[0][0]()
    expect(mock.dispatch).toHaveBeenCalledExactlyOnceWith(payload, 2, 42)
  })
  it('contains configuration/database errors and never logs their sensitive details', async () => {
    mock.dispatch.mockRejectedValue(new Error('secret@example.invalid token=private'))
    sendCheckoutEmails(payload, 'order-1')
    await expect(mock.after.mock.calls[0][0]()).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalledWith('[order-email] Automatic delivery unavailable; check admin email queue.')
  })
  it('does not fail a committed checkout if post-response work registration fails', () => {
    mock.after.mockImplementation(() => { throw new Error('unavailable') })
    expect(() => sendCheckoutEmails(payload, 'order-1')).not.toThrow()
    expect(mock.dispatch).not.toHaveBeenCalled()
  })
})
