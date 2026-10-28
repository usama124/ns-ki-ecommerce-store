// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { signOrderAccess, verifyOrderAccess } from '@/utilities/orderAccess'
import { orderOwner } from '@/access/orderOwner'

describe('Scoped order-view capabilities', () => {
  const secret = 'unit-test-signing-key-not-used-outside-this-test'
  const now = 1_792_000_000_000
  it('accepts only the signed order and signing key before expiry', () => {
    const token = signOrderAccess('order-a', secret, now)
    expect(verifyOrderAccess('order-a', token, secret, now + 1000)).toBe(true)
    expect(verifyOrderAccess('order-b', token, secret, now)).toBe(false)
    expect(verifyOrderAccess('order-a', token, 'wrong-secret', now)).toBe(false)
    expect(verifyOrderAccess('order-a', token, secret, now + 7 * 86400_000)).toBe(false)
  })
  it('rejects missing, malformed, tampered and future-dated grants', () => {
    for (const token of [
      undefined,
      null,
      {},
      '1.bad',
      '9999999999.' + 'a'.repeat(64),
      signOrderAccess('a', secret, now).replace(/.$/, 'z'),
    ]) {
      expect(verifyOrderAccess('a', token, secret, now)).toBe(false)
    }
    expect(() => signOrderAccess('a', '', now)).toThrow()
  })
  it('does not use an editable delivery email to establish account ownership', () => {
    expect(orderOwner({ req: { user: null } } as never)).toBe(false)
    expect(
      orderOwner({
        req: { user: { id: 'customer-a', roles: ['customer'], email: 'same@example.test' } },
      } as never),
    ).toEqual({ customerAccount: { equals: 'customer-a' } })
    expect(orderOwner({ req: { user: { id: 'admin', roles: ['admin'] } } } as never)).toBe(true)
  })
})
