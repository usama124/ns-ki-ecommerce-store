import type { Where } from 'payload'
import { privateJSON, RequestError, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { getOrderStats, orderStatuses, reportPage } from '@/utilities/orderReport'

export async function GET(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)
    const search = new URL(req.url).searchParams
    const status = search.get('status') || 'all'
    const q = search.get('q')?.trim() || ''
    if (q.length > 100) throw new RequestError('Search is too long.')
    const groups: Record<string, string[]> = { confirmed_processing: ['confirmed', 'processing'], shipped_delivered: ['shipped', 'delivered'] }
    const group = Object.hasOwn(groups, status) ? groups[status] : undefined
    if (status !== 'all' && !orderStatuses.includes(status as typeof orderStatuses[number]) && !group) throw new RequestError('Invalid order status.')
    const and: Where[] = []
    if (status !== 'all') and.push({ status: { in: group || [status] } })
    if (q) and.push({ or: ['orderNumber', 'customer.name', 'customer.email', 'customer.phone', 'customer.city', 'paymentProof.transactionId'].map(field => ({ [field]: { contains: q } })) })
    const [result, stats] = await Promise.all([
      payload.find({ collection: 'orders', depth: 2, limit: 50, page: reportPage(search), sort: ['-createdAt', '-id'], where: and.length ? { and } : undefined, user, overrideAccess }),
      getOrderStats(payload, user),
    ])
    return privateJSON({ success: true, stats, statsScope: 'all_orders', orders: result.docs,
      pagination: { page: result.page || 1, totalPages: result.totalPages || 1, totalDocs: result.totalDocs, hasNextPage: Boolean(result.hasNextPage), hasPrevPage: Boolean(result.hasPrevPage) } })
  } catch (error) { return requestError(error) }
}
