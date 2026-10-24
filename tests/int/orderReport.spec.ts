// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const aggregate = vi.hoisted(() => vi.fn())
vi.mock('@/utilities/commerceDatabase', () => ({ mongoCommerce: () => ({ adapter: { collections: { orders: { collection: { collectionName: 'orders' } } } }, db: { collection: () => ({ aggregate }) } }) }))
import { getOrderStats, reportPage } from '@/utilities/orderReport'

const admin = { id: 1, roles: ['admin'] } as never
beforeEach(() => vi.resetAllMocks())
describe('complete order summaries and bounded report pages', () => {
  it('aggregates across more than 500 orders without loading full documents', async () => {
    aggregate.mockReturnValue({ toArray: async () => [{ _id: 'confirmed', count: 501, value: 501000 }, { _id: 'cancelled', count: 2, value: 9000 }] })
    expect(await getOrderStats({ db: { name: 'mongoose' } } as never, admin)).toMatchObject({ totalOrders: 503, confirmed: 501, cancelled: 2, totalRevenue: 501000 })
    expect(aggregate.mock.calls[0][0][0].$group).toEqual({ _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalAmount' } })
  })
  it('denies non-administrators before aggregation', async () => {
    await expect(getOrderStats({ db: { name: 'mongoose' } } as never, { roles: ['customer'] } as never)).rejects.toThrow('forbidden')
    expect(aggregate).not.toHaveBeenCalled()
  })
  it('traverses bounded access-controlled pages on non-Mongo adapters', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: Array(200).fill({ status: 'confirmed', totalAmount: 1000 }), hasNextPage: true })
      .mockResolvedValueOnce({ docs: Array(200).fill({ status: 'delivered', totalAmount: 1000 }), hasNextPage: true })
      .mockResolvedValueOnce({ docs: Array(101).fill({ status: 'cancelled', totalAmount: 1000 }), hasNextPage: false })
    expect(await getOrderStats({ db: { name: 'postgres' }, find } as never, admin)).toMatchObject({ totalOrders: 501, totalRevenue: 400000, cancelled: 101 })
    expect(find.mock.calls.map(([args]) => args.page)).toEqual([1, 2, 3])
    for (const [args] of find.mock.calls) expect(args).toMatchObject({ user: admin, overrideAccess: false, limit: 200, depth: 0 })
  })
  it.each(['0', '-1', '1.5', 'Infinity', 'bad', '1000001'])('rejects invalid page %s', page => {
    expect(() => reportPage(new URLSearchParams({ page }))).toThrow()
  })
  it('allows bounded pages and defaults to page one', () => {
    expect(reportPage(new URLSearchParams())).toBe(1)
    expect(reportPage(new URLSearchParams('page=11'))).toBe(11)
  })
})
