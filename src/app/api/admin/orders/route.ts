import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') || 'all'
    const searchQuery = searchParams.get('q')?.trim() || ''

    const payload = await getPayload({ config: configPromise })

    // Fetch all orders for metrics and filtering
    const allOrdersRes = await payload.find({
      collection: 'orders',
      depth: 2,
      limit: 500,
      overrideAccess: true,
      sort: '-createdAt',
    })

    const orders = allOrdersRes.docs || []

    // Calculate individual metrics for every status
    const totalOrders = orders.length
    const pendingVerification = orders.filter(
      (o: any) => o.status === 'pending_verification',
    ).length
    const confirmed = orders.filter((o: any) => o.status === 'confirmed').length
    const processing = orders.filter((o: any) => o.status === 'processing').length
    const shipped = orders.filter((o: any) => o.status === 'shipped').length
    const delivered = orders.filter((o: any) => o.status === 'delivered').length
    const cancelled = orders.filter((o: any) => o.status === 'cancelled').length

    // Revenue sum for non-cancelled / non-pending orders
    const totalRevenue = orders
      .filter((o: any) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status))
      .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0)

    // Filter list by status & search query
    let filteredOrders = orders

    if (statusFilter !== 'all') {
      if (statusFilter === 'confirmed_processing') {
        filteredOrders = filteredOrders.filter(
          (o: any) => o.status === 'confirmed' || o.status === 'processing',
        )
      } else if (statusFilter === 'shipped_delivered') {
        filteredOrders = filteredOrders.filter(
          (o: any) => o.status === 'shipped' || o.status === 'delivered',
        )
      } else {
        filteredOrders = filteredOrders.filter((o: any) => o.status === statusFilter)
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filteredOrders = filteredOrders.filter((o: any) => {
        const orderNum = (o.orderNumber || '').toLowerCase()
        const custName = (o.customer?.name || '').toLowerCase()
        const custEmail = (o.customer?.email || '').toLowerCase()
        const custPhone = (o.customer?.phone || '').toLowerCase()
        const custCity = (o.customer?.city || '').toLowerCase()
        const trxId = (o.paymentProof?.transactionId || '').toLowerCase()
        return (
          orderNum.includes(q) ||
          custName.includes(q) ||
          custEmail.includes(q) ||
          custPhone.includes(q) ||
          custCity.includes(q) ||
          trxId.includes(q)
        )
      })
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalOrders,
        pendingVerification,
        confirmed,
        processing,
        shipped,
        delivered,
        cancelled,
        totalRevenue,
      },
      orders: filteredOrders,
    })
  } catch (error: any) {
    console.error('Error fetching admin orders:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch admin orders.' },
      { status: 500 },
    )
  }
}
