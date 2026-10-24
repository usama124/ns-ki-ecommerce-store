import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'

export async function GET(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)

    const [ordersResult, productsResult, usersResult] = await Promise.allSettled([
      payload.find({
        collection: 'orders' as any,
        user,
        overrideAccess,
        limit: 0,
        depth: 0,
      }),
      payload.find({
        collection: 'products',
        user,
        overrideAccess,
        limit: 0,
        depth: 0,
      }),
      payload.find({
        collection: 'users',
        user,
        overrideAccess,
        limit: 0,
        depth: 0,
      }),
    ])

    const totalOrders = ordersResult.status === 'fulfilled' ? ordersResult.value.totalDocs : 0
    const totalProducts = productsResult.status === 'fulfilled' ? productsResult.value.totalDocs : 0
    const totalUsers = usersResult.status === 'fulfilled' ? usersResult.value.totalDocs : 0

    // Sum revenue across all orders
    let revenue = 0
    if (ordersResult.status === 'fulfilled' && ordersResult.value.docs) {
      revenue = ordersResult.value.docs.reduce((sum: number, order: any) => {
        return sum + (order.total || order.totalAmount || order.grandTotal || 0)
      }, 0)
    }

    if ([ordersResult, productsResult, usersResult].some(result => result.status === 'rejected')) throw new Error('Report unavailable')
    return privateJSON({ totalOrders, totalProducts, totalUsers, revenue })
  } catch (error) {
    return requestError(error)
  }
}
