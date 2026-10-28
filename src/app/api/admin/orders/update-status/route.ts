import { privateJSON, readJSON, RequestError, requestError, requireAdmin, validDocumentID } from '@/utilities/apiSecurity'
import { commerceTransaction } from '@/utilities/commerceDatabase'

export async function POST(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)
    const body = await readJSON(req)
    const { orderIds, status, courierName, trackingNumber, trackingUrl, notes } = body

    const targetIds: Array<string | number> = Array.isArray(orderIds)
      ? orderIds
      : typeof orderIds === 'string' && orderIds
      ? [orderIds]
      : []

    if (targetIds.length === 0 || targetIds.length > 100 || targetIds.some(id => !validDocumentID(id))) {
      throw new RequestError('Provide 1–100 valid order IDs.')
    }

    const validStatuses = ['pending_verification', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      throw new RequestError('Invalid order status provided.')
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 5000)) throw new RequestError('Invalid notes.')
    for (const value of [courierName, trackingNumber, trackingUrl]) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 1000)) throw new RequestError('Invalid fulfillment details.')
    }
    if (trackingUrl && (typeof trackingUrl !== 'string' || !/^https:\/\//i.test(trackingUrl))) throw new RequestError('Tracking URL must use HTTPS.')
    const updatedOrders = []

    for (const id of targetIds) {
      const updated = await commerceTransaction(payload, user, async transactionReq => {
      const existingOrder = await payload.findByID({
        collection: 'orders',
        id,
        depth: 0,
        user,
        overrideAccess,
        req: transactionReq,
      })

      if (!existingOrder) throw new RequestError('Order unavailable.', 404)

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
        user,
        overrideAccess,
        req: transactionReq,
      })

      return updated
      })
      updatedOrders.push(updated)
    }

    return privateJSON({
      success: true,
      updatedCount: updatedOrders.length,
      orders: updatedOrders,
    })
  } catch (error) {
    return requestError(error)
  }
}

