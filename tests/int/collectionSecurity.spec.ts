// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Orders } from '@/collections/Orders'
import { Media } from '@/collections/Media'
import { Products } from '@/collections/Products'
import { paymentConfigured } from '@/utilities/paymentConfiguration'

describe('Generated collection API access', () => {
  for (const user of [
    null,
    { id: 'customer', roles: ['customer'] },
    { id: 'admin', roles: ['admin'] },
  ]) {
    it(`allows generic order/media creation only for admins (${user?.id || 'guest'})`, async () => {
      const args = { req: { user } } as never
      const admin = user?.id === 'admin'
      expect(await Orders.access!.create!(args)).toBe(admin)
      expect(await Media.access!.create!(args)).toBe(admin)
      expect(await Products.access!.read!(args)).toEqual(
        admin ? true : { status: { equals: 'published' } },
      )
      expect(await Media.access!.read!(args)).toEqual(
        admin
          ? true
          : { or: [{ alt: { exists: false } }, { alt: { not_like: 'Payment proof from' } }] },
      )
    })
  }
  it('does not expose payment proofs or internal notes through owner-readable order APIs', async () => {
    for (const name of ['paymentProof', 'paymentProofHash', 'notes']) {
      const field = Orders.fields.find((field) => 'name' in field && field.name === name)
      expect(
        field &&
          'access' in field &&
          (await field.access?.read?.({
            req: { user: { id: 'customer', roles: ['customer'] } },
          } as never)),
      ).toBe(false)
    }
  })
})

describe('No placeholder payment destinations', () => {
  it('keeps COD available but disables digital methods with absent or template settings', () => {
    expect(paymentConfigured(undefined, 'cod')).toBe(true)
    expect(paymentConfigured(undefined, 'bank_transfer')).toBe(false)
    expect(
      paymentConfigured(
        {
          paymentDetails: {
            bankTransfer: {
              bankName: 'Test',
              accountTitle: 'Test',
              accountNumber: 'PK00MEZN0001020304050607',
              raastId: '03001234567',
            },
          },
        },
        'bank_transfer',
      ),
    ).toBe(false)
    expect(
      paymentConfigured(
        { paymentDetails: { jazzcash: { mobileNumber: '03001234567', accountName: 'Template' } } },
        'jazzcash',
      ),
    ).toBe(false)
  })
  it('permits configured destinations without claiming the bank account is verified', () => {
    expect(
      paymentConfigured(
        {
          paymentDetails: {
            bankTransfer: {
              bankName: 'Test',
              accountTitle: 'Test',
              accountNumber: 'PK12TEST1234567891234567',
            },
          },
        },
        'bank_transfer',
      ),
    ).toBe(true)
    expect(
      paymentConfigured(
        { paymentDetails: { easypaisa: { mobileNumber: '03001112222', accountName: 'Test' } } },
        'easypaisa',
      ),
    ).toBe(true)
  })
})
