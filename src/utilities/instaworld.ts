import type { Payload, PayloadRequest } from 'payload'
import type { Order, User } from '@/payload-types'
import { randomUUID, createHash } from 'node:crypto'
import { RequestError } from './apiSecurity'
import { checkRole } from '@/access/utilities'
import { cityKey } from './codCoverage'
import { MONEY } from './paymentLedger'
import { COMMERCE, commerceSession, commerceTransaction, mongoCommerce, requireCommerceReady, type InternalRecord } from './commerceDatabase'
import { InstaError, instaReferences, instaRequest, safeEvents, safeShipment, type InstaTracking } from './instaworldClient'

// Existing private config collection supplies a durable unique _id and requires
// no lazy index/collection DDL on order requests. Never exposed by Payload REST.
const recordID = (id: string | number) => `instaworld:booking:${id}`
type Booking = InternalRecord & {
  state: 'sending' | 'uncertain' | 'retryable' | 'booked'; reference: string;
  key: string; body: ReturnType<typeof bookingBody>; startedAt: Date; leaseUntil: Date;
  tracking?: InstaTracking; fingerprint: string; failure?: string;
  credentialHash: string;
  refreshAfter?: Date;
}
function admin(user: User) { if (!checkRole(['admin'], user)) throw new RequestError('Action forbidden.', 403) }
function signature(order: Partial<Order>) {
  return JSON.stringify([order.customer, order.items, order.paymentMethod, order.subtotal, order.shippingFee, order.codFee, order.totalAmount])
}

export function bookingBody(order: Order, input: Record<string, unknown>, references: Awaited<ReturnType<typeof instaReferences>>) {
  if (order.status !== 'processing' || order.paymentMethod !== 'cod') throw new RequestError('Only Processing COD orders can be booked.', 409)
  if (order.fulfillment?.trackingNumber) throw new RequestError('This order already has manually assigned tracking. Reconcile it before booking.', 409)
  if (!Number.isSafeInteger(input.locationId) || !references.locations.some(l => l.id === input.locationId)) throw new RequestError('Select an active InstaWorld pickup location.')
  // Exact city only: operator explicitly chooses the provider destination. No
  // fuzzy town/province guesses. Show both stored and provider city in admin.
  if (typeof input.city !== 'string' || !references.cities.includes(input.city)) throw new RequestError('Select a serviceable InstaWorld destination city.')
  if (cityKey(input.city) !== cityKey(order.customer.city)) throw new RequestError('Destination must match the order city. Correct the order address before booking.')
  if (!order.customer.name?.trim() || order.customer.name.length > 120 || !order.items?.length) throw new RequestError('Order customer name and items need review before booking.')
  if (!order.customer.address?.trim() || order.customer.address.length > 200) throw new RequestError('InstaWorld requires an address of 1–200 characters. Correct the order address first.')
  if (!/^(?:\+92|0)3\d{9}$/.test(order.customer.phone.replace(/[\s()-]/g, ''))) throw new RequestError('A valid Pakistani mobile number is required for booking.')
  if (!Array.isArray(input.weightsKg) || input.weightsKg.length !== order.items.length || input.weightsKg.some(w => typeof w !== 'number' || !Number.isFinite(w) || w <= 0 || w > 100)) throw new RequestError('Enter a positive weight in kg for every order item (maximum 100 kg each).')
  if (!Number.isSafeInteger(order.totalAmount) || order.totalAmount <= 0) throw new RequestError('Order total is not valid for COD booking.')
  if (order.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0)) throw new RequestError('Order item amounts need review before booking.')
  return {
    location_id: input.locationId, ref_no: order.orderNumber,
    payment: { type: 'cod', amount: order.totalAmount },
    consignee: { first_name: order.customer.name, phone: order.customer.phone.replace(/[\s()-]/g, ''), address: order.customer.address, city: input.city, ...(order.customer.email ? { email: order.customer.email } : {}) },
    items: order.items.map((item, index) => ({ title: item.variantSku || `Product ${typeof item.product === 'object' ? item.product.id : item.product}`, sku: item.variantSku || undefined, quantity: item.quantity, price: item.unitPrice, kg: (input.weightsKg as number[])[index] })),
    open_parcel_feature: false,
  }
}

/** Prevent stale order edits/cancellation while the real parcel may be live. */
export async function guardInstaOrder(previous: Order | undefined, next: Partial<Order> | null, req: PayloadRequest) {
  if (!previous || req.payload.db?.name !== 'mongoose') return
  const booking = await mongoCommerce(req.payload).db.collection<Booking>(COMMERCE.config).findOne({ _id: recordID(previous.id) }, { session: await commerceSession(req) })
  if (!booking) return
  if (!next || signature(previous) !== signature({ ...previous, ...next }) || (next.fulfillment !== undefined && JSON.stringify(next.fulfillment) !== JSON.stringify(previous.fulfillment)) || (next.status && !['processing', 'shipped', 'delivered'].includes(next.status)))
    throw new RequestError('This order has an InstaWorld booking attempt. Reconcile/cancel it with InstaWorld before changing shipment details, cancelling or deleting the order.', 409)
}

export async function bookInstaOrder(payload: Payload, user: User, id: string | number, input: Record<string, unknown>) {
  admin(user)
  if (!process.env.INSTAWORLD_API_KEY?.trim()) throw new RequestError('InstaWorld API key is not configured.', 503)
  const { db, adapter } = await requireCommerceReady(payload)
  const records = db.collection<Booking>(COMMERCE.config)
  const existing = await records.findOne({ _id: recordID(id) })
  const credentialHash = createHash('sha256').update(process.env.INSTAWORLD_API_KEY!.trim()).digest('hex')
  if (existing && existing.credentialHash !== credentialHash) throw new RequestError('The InstaWorld credential changed. Reconcile the saved booking before retrying with another key.', 409)
  // Freeze the original request across retries, regardless of changed UI values.
  const references = existing ? null : await instaReferences()
  const booking = await commerceTransaction(payload, user, async req => {
    const session = await commerceSession(req)
    const order = await payload.findByID({ collection: 'orders', id, user, overrideAccess: false, depth: 0, req })
    const previous = await records.findOne({ _id: recordID(id) }, { session })
    if (previous?.state === 'booked') return previous
    if (previous && previous.leaseUntil > new Date()) throw new RequestError('Booking is already running. Refresh after a minute.', 409)
    if (order.status !== 'processing' || order.paymentMethod !== 'cod') throw new RequestError('Only Processing COD orders can be booked.', 409)
    if (!previous && await db.collection(MONEY.entries).findOne({ orderId: String(id) }, { session, projection: { _id: 1 } }))
      throw new RequestError('Orders with recorded money need manual COD balance reconciliation before booking.', 409)
    const body = previous?.body || bookingBody(order, input, references!)
    // Every booking/edit writer touches the same order document so MongoDB
    // serializes concurrent booking versus cancellation/address/amount edits.
    const model = adapter.collections.orders
    const oid = model.schema.path('_id').cast(order.id)
    const fenced = await model.collection.updateOne({ _id: oid }, { $set: { __nskiInstaFence: randomUUID() } }, { session })
    if (fenced.matchedCount !== 1) throw new RequestError('Order unavailable for shipment booking.', 409)
    await model.collection.updateOne({ _id: oid }, { $unset: { __nskiInstaFence: '' } }, { session })
    const claimed: Booking = previous || {
      _id: recordID(id), state: 'sending', reference: order.orderNumber,
      key: `nski-${id}-${randomUUID()}`, body, fingerprint: createHash('sha256').update(signature(order)).digest('hex'),
      startedAt: new Date(), leaseUntil: new Date(), credentialHash, actorId: String(user.id),
    }
    if (claimed.fingerprint !== createHash('sha256').update(signature(order)).digest('hex')) throw new RequestError('Order details no longer match the saved booking. Reconciliation is required.', 409)
    claimed.leaseUntil = new Date(Date.now() + 60000)
    await records.replaceOne({ _id: claimed._id }, claimed, { upsert: true, session })
    return claimed
  }, true)
  if (booking.state === 'booked') return booking.tracking
  const expired = Date.now() - new Date(booking.startedAt).getTime() >= 23 * 3600000
  try {
    // Always search before creating; also catches portal bookings for this ref.
    const matches = await instaRequest(`/shipments?ref_no=${encodeURIComponent(booking.reference)}&location_id=${booking.body.location_id}&limit=200`)
    if (!Array.isArray(matches) || matches.length >= 200) throw new InstaError('invalid_or_incomplete_lookup', 200)
    const candidates = matches.filter(m => m.ref_no === booking.reference && m.location_id === booking.body.location_id)
    if (candidates.length > 1) throw new RequestError('Multiple shipments match this order. Resolve them in InstaWorld before continuing.', 409)
    let shipment: unknown
    if (candidates.length === 1) {
      const candidate = candidates[0]
      if (candidate.payment?.type !== 'cod' || candidate.payment?.amount !== booking.body.payment.amount) throw new RequestError('Existing shipment amount does not match this order. Manual reconciliation is required.', 409)
      shipment = await instaRequest(`/shipments/${encodeURIComponent(candidate.tracking_number)}`)
    } else {
      if (expired) throw new RequestError('The safe booking retry window has expired. Reconcile with InstaWorld support; no new booking was sent.', 409)
      shipment = await instaRequest('/shipments', booking.body, booking.key)
    }
    const full = shipment as { location_id?: number; payment?: { type?: string; amount?: number }; consignee?: { city?: string; phone?: string; address?: string } }
    if (full?.location_id !== booking.body.location_id || full?.payment?.type !== 'cod' || full?.payment?.amount !== booking.body.payment.amount || full?.consignee?.city?.trim().toLowerCase() !== booking.body.consignee.city.trim().toLowerCase() || full?.consignee?.phone?.replace(/[\s()-]/g, '').replace(/^\+92/, '0') !== booking.body.consignee.phone.replace(/^\+92/, '0') || full?.consignee?.address !== booking.body.consignee.address)
      throw new RequestError('Shipment details do not match the saved booking. Manual reconciliation is required.', 409)
    const tracking = safeShipment(shipment, booking.reference)
    await records.updateOne({ _id: booking._id }, { $set: { state: 'booked', tracking, leaseUntil: new Date(0) }, $unset: { failure: '' } })
    return tracking
  } catch (error) {
    // Never delete the identity or change the payload after an ambiguous result.
    await records.updateOne({ _id: booking._id }, { $set: { state: error instanceof InstaError && error.code === 'booking_failed' ? 'retryable' : 'uncertain', failure: error instanceof InstaError ? error.code : 'reconciliation_required', leaseUntil: error instanceof InstaError && error.retryAfterSeconds ? new Date(Date.now() + error.retryAfterSeconds * 1000) : new Date(0) } })
    if (error instanceof RequestError) throw error
    throw new RequestError('Booking outcome is uncertain. Refresh and retry this same order; do not book another consignment in the portal.', 503)
  }
}

export async function instaOrderTracking(payload: Payload, id: string | number, refresh = false) {
  const { db } = await requireCommerceReady(payload)
  const records = db.collection<Booking>(COMMERCE.config)
  const booking = await records.findOne({ _id: recordID(id) })
  if (!booking) return null
  if (!booking.tracking || !refresh || Date.now() - Date.parse(booking.tracking.checkedAt) < 60000) return booking.tracking || null
  if (booking.refreshAfter && booking.refreshAfter > new Date()) return booking.tracking
  if (!process.env.INSTAWORLD_API_KEY || booking.credentialHash !== createHash('sha256').update(process.env.INSTAWORLD_API_KEY.trim()).digest('hex')) return booking.tracking
  const lease = await records.updateOne({ _id: booking._id, leaseUntil: { $lte: new Date() }, $or: [{ refreshAfter: { $exists: false } }, { refreshAfter: { $lte: new Date() } }] }, { $set: { leaseUntil: new Date(Date.now() + 45000), refreshAfter: new Date(Date.now() + 60000) } })
  if (!lease.modifiedCount) return booking.tracking
  try {
    const trackingNumber = booking.tracking.trackingNumber
    const [detail, events] = await Promise.all([instaRequest(`/shipments/${encodeURIComponent(trackingNumber)}`), instaRequest(`/shipments/${encodeURIComponent(trackingNumber)}/events`)])
    const tracking = safeShipment(detail, booking.reference, trackingNumber)
    tracking.events = safeEvents(events)
    // Do not regress to an older provider observation.
    if (booking.tracking.statusRecordedAt && (!tracking.statusRecordedAt || tracking.statusRecordedAt < booking.tracking.statusRecordedAt)) return booking.tracking
    await records.updateOne({ _id: booking._id }, { $set: { tracking }, $unset: { failure: '' } })
    return tracking
  } catch (error) {
    if (error instanceof InstaError && error.retryAfterSeconds) await records.updateOne({ _id: booking._id }, { $set: { refreshAfter: new Date(Date.now() + Math.max(60, error.retryAfterSeconds) * 1000) } })
    return booking.tracking
  }
  finally { await records.updateOne({ _id: booking._id }, { $set: { leaseUntil: new Date(0) } }) }
}

export async function instaAdminState(payload: Payload, user: User, id: string | number, refresh: boolean) {
  admin(user)
  await payload.findByID({ collection: 'orders', id, user, overrideAccess: false, depth: 0 })
  const tracking = await instaOrderTracking(payload, id, refresh)
  const record = await mongoCommerce(payload).db.collection<Booking>(COMMERCE.config).findOne({ _id: recordID(id) })
  return { tracking, bookingState: record?.state || null, failure: record?.failure || null, configured: Boolean(process.env.INSTAWORLD_API_KEY?.trim()) }
}
