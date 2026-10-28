import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { getOrderStats } from '@/utilities/orderReport'

export async function GET(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)

    const [orders, products, users] = await Promise.all([
      getOrderStats(payload, user),
      payload.count({ collection: 'products', user, overrideAccess }),
      payload.count({ collection: 'users', user, overrideAccess }),
    ])
    return privateJSON({
      totalOrders: orders.totalOrders,
      totalProducts: products.totalDocs,
      totalUsers: users.totalDocs,
      revenue: orders.totalRevenue,
      revenueDefinition: 'Current accepted order value including shipping/COD; not collected cash.',
    })
  } catch (error) {
    return requestError(error)
  }
}
