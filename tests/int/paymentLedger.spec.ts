// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { moneyMinor, parseMoneyCommand, totalMinor } from '@/lib/payments/model'
import { moneyFilters, moneyCSV, moneyReport } from '@/lib/payments/report'
import { initializeMoney, moneyStatus, recordMoney } from '@/utilities/paymentLedger'
const body = {
  key: 'd303277e-3c48-40e6-b7d0-9f2e6a300039',
  orderId: 'order-1',
  kind: 'collection',
  amount: '12.34',
  method: 'cash',
  reason: 'customer_payment',
  occurredAt: '2026-01-02T03:04:05Z',
}
describe('recorded money contracts', () => {
  it.each(['0', '-1', '1e3', 'NaN', '1.001', ' 1', '01', '1000000000', 1, null])(
    'rejects unsafe amounts %s',
    (amount) => {
      expect(() => moneyMinor(amount)).toThrow()
    },
  )
  it('uses exact minor units and validates order precision', () => {
    expect(moneyMinor('12.34')).toBe(1234)
    expect(moneyMinor('1.1')).toBe(110)
    expect(moneyMinor('0.01')).toBe(1)
    expect(totalMinor(1350)).toBe(135000)
    expect(() => totalMinor(1.001)).toThrow()
  })
  it('normalizes the same command for deterministic replay', () => {
    expect(parseMoneyCommand(body)).toMatchObject({
      amountMinor: 1234,
      refundOf: '',
      occurredAt: '2026-01-02T03:04:05.000Z',
    })
    expect(
      parseMoneyCommand({ ...body, occurredAt: body.occurredAt.replace('Z', '.000Z') }),
    ).toEqual(parseMoneyCommand(body))
  })
  it.each([
    { amount: '0' },
    { extra: 'PII' },
    { key: '$where' },
    { orderId: { $ne: null } },
    { kind: 'refund' },
    { reason: 'free-form' },
    { method: 'cod' },
    { occurredAt: '2100-01-01T00:00:00Z' },
    { occurredAt: '2026-02-30T03:04:05Z' },
    { occurredAt: '2026-01-01' },
    { occurredAt: '2026-01-02T03:04:05+05:00' },
    { refundOf: body.key },
  ])('rejects invalid/private arbitrary input %#', (change) => {
    expect(() => parseMoneyCommand({ ...body, ...change })).toThrow()
  })
  it('requires a collection key and refund reason', () => {
    expect(
      parseMoneyCommand({ ...body, kind: 'refund', reason: 'return', refundOf: body.key }),
    ).toMatchObject({ kind: 'refund' })
  })
  it.each([
    'page=0',
    'format=xml',
    'start=2026-10-25',
    'orderId=$where',
    'key=foo',
    'page=1&page=2',
    'start=2025-01-01&end=2026-10-25',
  ])('rejects unsafe report filters %s', (query) => {
    expect(() => moneyFilters(new URLSearchParams(query))).toThrow()
  })
  it('roundtrips normalized date/page/export filters', () => {
    const filters = moneyFilters(new URLSearchParams('orderId=order-1'))
    expect(
      moneyFilters(
        new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])),
      ),
    ).toEqual(filters)
  })
  it.each([null, { roles: ['customer'] }])(
    'all native services reject non-admins before DB access %#',
    async (user) => {
      const p = {} as Payload,
        u = user as User
      for (const call of [
        () => moneyStatus(p, u),
        () => initializeMoney(p, u),
        () => recordMoney(p, u, body),
        () => moneyReport(p, u, new URLSearchParams()),
        () => moneyCSV(p, u, {} as never),
      ])
        await expect(call()).rejects.toMatchObject({ status: 403 })
    },
  )
})
