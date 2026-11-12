// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeStreetAddress } from '@/utilities/streetAddress'
import { parseCheckout } from '@/utilities/checkoutQuote'
import { checkoutIntentEligible } from '@/lib/analytics/model'

const customer = { name: 'Test Customer', phone: '03001234567', email: '', city: 'Lahore', province: 'Punjab', address: 'House 12\nStreet 3\nBlock A' }
const checkout = (paymentMethod: string, address: unknown) => ({ customer: { ...customer, address }, paymentMethod, paymentProof: { transactionId: 'ABC123' }, items: [{ productId: 'product-1', variantSize: 'M', quantity: 1 }] })
describe('multiline street addresses', () => {
  it.each(['cod', 'bank_transfer', 'jazzcash', 'easypaisa'])('accepts multiline addresses in %s checkout parsing', method => {
    expect(parseCheckout(checkout(method, customer.address)).customer.address).toBe(customer.address)
  })
  it('preserves interior line breaks and normalizes saved-address CRLF/CR endings', () => {
    expect(normalizeStreetAddress('  House 12\r\nStreet 3\rBlock A  ')).toBe(customer.address)
    expect(normalizeStreetAddress('House 12\n\nStreet 3')).toBe('House 12\n\nStreet 3')
    expect(normalizeStreetAddress('مکان ۱۲\nگلی ۳')).toBe('مکان ۱۲\nگلی ۳')
  })
  it.each(['', ' \r\n ', null, undefined, {}, 'House\u0000No', 'House\tNo', 'House\u001bNo', '<script>', 'x'.repeat(501)])('rejects invalid address %j', address => {
    expect(normalizeStreetAddress(address)).toBeNull()
    expect(() => parseCheckout(checkout('cod', address))).toThrow('street address')
  })
  it('retains the 500-character limit', () => {
    expect(normalizeStreetAddress('x'.repeat(499) + 'y')).toHaveLength(500)
  })
  it.each(['name', 'phone', 'email', 'city', 'province'])('does not allow newlines in %s', field => {
    const input = checkout('cod', customer.address)
    Object.assign(input.customer, { [field]: 'First\nSecond' })
    expect(() => parseCheckout(input)).toThrow()
  })
  it('does not allow newlines in variant sizes or transaction references', () => {
    const input = checkout('cod', customer.address)
    input.items[0].variantSize = 'M\nL'
    expect(() => parseCheckout(input)).toThrow()
    const transfer = checkout('bank_transfer', customer.address)
    transfer.paymentProof.transactionId = 'ABC\n123'
    expect(() => parseCheckout(transfer)).toThrow()
  })
  it('keeps valid multiline checkout analytics intent eligible without sending addresses', () => {
    expect(checkoutIntentEligible(customer, 'cod', '')).toBe(true)
    expect(checkoutIntentEligible({ ...customer, address: 'House\u0000No' }, 'cod', '')).toBe(false)
  })
})
