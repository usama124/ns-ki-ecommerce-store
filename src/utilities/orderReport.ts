import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { checkRole } from '@/access/utilities'
import { RequestError } from './apiSecurity'
import { mongoCommerce } from './commerceDatabase'

export const orderStatuses = ['pending_verification', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const
export type OrderStats = {
  totalOrders: number; pendingVerification: number; confirmed: number; processing: number
  shipped: number; delivered: number; cancelled: number; totalRevenue: number
}
export async function getOrderStats(payload: Payload, user: User): Promise<OrderStats> {
  if (!checkRole(['admin'], user)) throw new RequestError('Action forbidden.', 403)
  const stats: OrderStats = { totalOrders: 0, pendingVerification: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, totalRevenue: 0 }
  if (payload.db.name === 'mongoose') {
    // Fixed aggregate after explicit administrator authorization; never project PII.
    const { adapter, db } = mongoCommerce(payload)
    const rows = await db.collection(adapter.collections.orders.collection.collectionName).aggregate<{
      _id: string; count: number; value: number
    }>([{ $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalAmount' } } }], { maxTimeMS: 10000 }).toArray()
    for (const row of rows) {
      stats.totalOrders += row.count
      if (row._id === 'pending_verification') stats.pendingVerification += row.count
      else if (orderStatuses.includes(row._id as typeof orderStatuses[number])) stats[row._id as Exclude<typeof orderStatuses[number], 'pending_verification'>] += row.count
      if (['confirmed', 'processing', 'shipped', 'delivered'].includes(row._id)) stats.totalRevenue += row.value
    }
    return stats
  }
  // Preserve adapter compatibility with bounded, access-controlled pages.
  let page = 1
  while (true) {
    const result = await payload.find({ collection: 'orders', user, overrideAccess: false, depth: 0, limit: 200, page, sort: 'id', select: { status: true, totalAmount: true } })
    for (const order of result.docs) {
      stats.totalOrders++
      if (order.status === 'pending_verification') stats.pendingVerification++
      else if (order.status && orderStatuses.includes(order.status)) stats[order.status]++
      if (['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status || '')) stats.totalRevenue += order.totalAmount || 0
    }
    if (!result.hasNextPage) break
    page++
  }
  return stats
}

export function reportPage(search: URLSearchParams) {
  const raw = search.get('page') || '1'
  const page = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new RequestError('Invalid report page.')
  return page
}
