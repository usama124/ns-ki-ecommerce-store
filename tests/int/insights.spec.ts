// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import {
  insightFilters,
  insightReport,
  insightStatus,
  initializeInsights,
  insightCSV,
} from '@/lib/reports/insights'
const now = new Date('2026-10-25T12:00:00Z')
describe('historical insight contracts', () => {
  it.each([
    'view=bad',
    'productId=$where&view=stock',
    'productId=valid-id',
    'page=0',
    'page=1&page=2',
    'format=xml',
    'start=2026-01-01',
    'start=2025-01-01&end=2026-10-25',
    'start=2026-10-25&end=2026-10-26',
    'source=money',
    'start=2026-02-30&end=2026-03-01',
  ])('rejects invalid or irrelevant filters %s', (query) => {
    expect(() => insightFilters(new URLSearchParams(query), now)).toThrow()
  })
  it.each(['trends', 'stock'])('roundtrips normalized %s filters', (view) => {
    const filters = insightFilters(
      new URLSearchParams({ view, ...(view === 'stock' ? { productId: 'product-1' } : {}) }),
      now,
    )
    expect(
      insightFilters(
        new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])),
        now,
      ),
    ).toEqual(filters)
  })
  it.each([null, { roles: ['customer'] }])(
    'denies every native insight service before touching the database %#',
    async (user) => {
      const p = {} as Payload,
        u = user as User
      for (const call of [
        () => insightStatus(p, u),
        () => initializeInsights(p, u),
        () => insightReport(p, u, new URLSearchParams()),
        () => insightCSV(p, u, {} as never),
      ])
        await expect(call()).rejects.toMatchObject({ status: 403 })
    },
  )
})
