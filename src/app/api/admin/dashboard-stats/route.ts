import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function GET() {
  try {
    const payload = await getPayload({ config })

    const [ordersResult, productsResult, usersResult] = await Promise.allSettled([
      payload.find({
        collection: 'orders' as any,
        limit: 0,
        depth: 0,
      }),
      payload.find({
        collection: 'products',
        limit: 0,
        depth: 0,
      }),
      payload.find({
        collection: 'users',
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

    return NextResponse.json({ totalOrders, totalProducts, totalUsers, revenue })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { totalOrders: 0, totalProducts: 0, totalUsers: 0, revenue: 0 },
      { status: 200 },
    )
  }
}
