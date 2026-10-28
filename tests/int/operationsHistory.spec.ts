// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { operationFilters, operationsReport, operationsStatus } from '@/lib/reports/operations'
import { captureInventoryBaselines, initializeOperations } from '@/utilities/operationsHistory'
describe('historical operations input and role boundaries', () => {
  it.each([
    'source=wrong',
    'source=stock&orderId=1',
    'source=orders&productId=1',
    'orderId=$where',
    'productId=%7B%7D',
    'source=orders&milestone=firstConfirmedAt',
    'source=milestones&milestone=paidAt',
    'format=xml',
    'page=0',
    'start=2026-10-25',
    'start=2026-02-30&end=2026-03-01',
    'source=stock&source=orders',
    'customerEmail=x@y.com',
    'status=confirmed',
  ])('rejects invalid, irrelevant and duplicate filters %s', (query) => {
    expect(() => operationFilters(new URLSearchParams(query))).toThrow()
  })
  it('keeps history event dates separate from placement cohorts', () => {
    expect(
      operationFilters(
        new URLSearchParams(
          'source=milestones&milestone=firstDeliveredAt&orderId=1&start=2026-10-25&end=2026-10-25&page=2',
        ),
      ),
    ).toMatchObject({
      source: 'milestones',
      milestone: 'firstDeliveredAt',
      orderId: '1',
      page: 2,
      format: 'json',
    })
  })
  it.each(['orders', 'stock', 'milestones'])(
    'normalized %s filters round-trip for exports and pagination',
    (source) => {
      const normalized = operationFilters(new URLSearchParams({ source }))
      const query = new URLSearchParams(
        Object.entries(normalized).map(([key, value]) => [key, String(value)]),
      )
      query.set('format', 'csv')
      expect(operationFilters(query)).toMatchObject({ source, format: 'csv' })
    },
  )
  it.each([null, { roles: ['customer'] }])(
    'requires admin authorization inside every native service %#',
    async (user) => {
      await expect(
        operationsReport({} as never, user as never, new URLSearchParams()),
      ).rejects.toMatchObject({ status: 403 })
      await expect(operationsStatus({} as never, user as never)).rejects.toMatchObject({
        status: 403,
      })
      await expect(initializeOperations({} as never, user as never)).rejects.toMatchObject({
        status: 403,
      })
      await expect(captureInventoryBaselines({} as never, user as never)).rejects.toMatchObject({
        status: 403,
      })
    },
  )
})
