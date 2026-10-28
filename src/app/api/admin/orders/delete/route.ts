import { privateJSON, readJSON, RequestError, requestError, requireAdmin, validDocumentID } from '@/utilities/apiSecurity'
import { commerceTransaction } from '@/utilities/commerceDatabase'

export async function POST(request: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(request)
    const { orderId, orderNumber } = await readJSON(request)
    if (!validDocumentID(orderId) || typeof orderNumber !== 'string' || !orderNumber || orderNumber.length > 100)
      throw new RequestError('Provide a valid order and its order number.')

    await commerceTransaction(payload, user, async req => {
      const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, user, overrideAccess, req, disableErrors: true })
      if (!order) throw new RequestError('Order unavailable.', 404)
      if (order.orderNumber !== orderNumber) throw new RequestError('Order details changed. Refresh and try again.', 409)
      if (order.status !== 'cancelled') throw new RequestError('Cancel and reconcile the order before deleting it.', 409)
      // Use Payload, not a raw Mongo delete: beforeDelete enforces the money
      // ledger guard and records order_deleted history in this transaction.
      await payload.delete({ collection: 'orders', id: orderId, user, overrideAccess, req })
    })
    return privateJSON({ success: true, deletedId: orderId })
  } catch (error) {
    return requestError(error)
  }
}
