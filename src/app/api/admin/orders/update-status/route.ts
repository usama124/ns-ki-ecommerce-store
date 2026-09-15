import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderIds, status, courierName, trackingNumber, trackingUrl, notes } = body

    const targetIds: string[] = Array.isArray(orderIds)
      ? orderIds
      : typeof orderIds === 'string' && orderIds
      ? [orderIds]
      : []

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'No order IDs provided.' }, { status: 400 })
    }

    const validStatuses = ['pending_verification', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid order status provided.' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const updatedOrders = []

    for (const id of targetIds) {
      const existingOrder = await payload.findByID({
        collection: 'orders',
        id,
        depth: 0,
        overrideAccess: true,
      })

      if (!existingOrder) continue

      const updateData: any = {
        status,
      }

      if (notes !== undefined) {
        updateData.notes = notes
      }

      // Handle fulfillment courier details if updating to shipped/delivered or providing courier info
      if (courierName || trackingNumber || trackingUrl) {
        updateData.fulfillment = {
          ...(existingOrder.fulfillment || {}),
          ...(courierName ? { courierName } : {}),
          ...(trackingNumber ? { trackingNumber } : {}),
          ...(trackingUrl !== undefined ? { trackingUrl } : {}),
        }
      }

      const updated = await payload.update({
        collection: 'orders',
        id,
        data: updateData,
        overrideAccess: true,
      })

      updatedOrders.push(updated)
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedOrders.length,
      orders: updatedOrders,
    })
  } catch (error: any) {
    console.error('Error updating order status:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update order status.' },
      { status: 500 }
    )
  }
}

