import type { PayloadRequest } from 'payload'
import { RequestError } from './apiSecurity'

export async function assertProductUnreserved(id: string | number, req: PayloadRequest) {
  const orders = await req.payload.find({
    collection: 'orders',
    req,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
    where: { and: [{ 'items.product': { equals: id } }, { status: { not_equals: 'cancelled' } }] },
    select: { orderNumber: true },
  })
  if (orders.docs.length)
    throw new RequestError(
      'This product has active orders. Cancel/reconcile them before deleting the product or removing variants.',
      409,
    )
}
