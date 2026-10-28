import type { Payload, PayloadRequest } from 'payload'
import type { Order, User } from '@/payload-types'
import { randomUUID } from 'node:crypto'
import { RequestError } from './apiSecurity'
import {
  COMMERCE,
  commerceSession,
  commerceTransaction,
  mongoCommerce,
  requireCommerceReady,
  type InternalRecord,
} from './commerceDatabase'
import { requireOperationsAdmin } from './operationsHistory'
import { parseMoneyCommand, totalMinor } from '@/lib/payments/model'

export const MONEY = {
  entries: 'nski_money_entries',
  balances: 'nski_money_balances',
  audit: 'nski_money_exports',
} as const
export async function moneyStatus(payload: Payload, user: User) {
  requireOperationsAdmin(user)
  const config = await mongoCommerce(payload)
    .db.collection<InternalRecord>(COMMERCE.config)
    .findOne({ _id: 'money-v1', ready: true })
  return { ready: Boolean(config), coverageStartedAt: config?.coverageStartedAt || null }
}
export async function initializeMoney(payload: Payload, user: User) {
  requireOperationsAdmin(user)
  const { db } = await requireCommerceReady(payload)
  for (const name of Object.values(MONEY))
    if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext()))
      await db.createCollection(name)
  await db.collection(MONEY.entries).createIndex({ orderId: 1, recordedAt: 1 })
  await db.collection(MONEY.entries).createIndex({ occurredAt: 1, _id: 1 })
  await db.collection(MONEY.entries).createIndex({ refundOf: 1 })
  await db.collection(MONEY.audit).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection<InternalRecord>(COMMERCE.config).updateOne(
    { _id: 'money-v1' },
    {
      $setOnInsert: { coverageStartedAt: new Date() },
      $set: { ready: true },
    },
    { upsert: true },
  )
}
export async function requireMoneyReady(payload: Payload) {
  const mongo = await requireCommerceReady(payload)
  if (
    !(await mongo.db
      .collection<InternalRecord>(COMMERCE.config)
      .findOne({ _id: 'money-v1', ready: true }))
  )
    throw new RequestError('Payment recording needs administrator initialization.', 503)
  return mongo
}

// Freeze financial terms after the first entry; status/contact/fulfillment edits remain allowed.
function financialTerms(order: Partial<Order>) {
  return JSON.stringify({
    total: order.totalAmount,
    subtotal: order.subtotal,
    shipping: order.shippingFee || 0,
    cod: order.codFee || 0,
    method: order.paymentMethod,
    items: order.items?.map((item) => ({
      product: typeof item.product === 'object' ? item.product?.id : item.product,
      size: item.variantSize,
      color: item.variantColor || '',
      sku: item.variantSku || '',
      quantity: item.quantity,
      price: item.unitPrice,
    })),
  })
}
export async function guardMoneyOrder(
  previous: Order,
  next: Partial<Order> | null,
  req: PayloadRequest,
) {
  if (next && financialTerms(previous) === financialTerms({ ...previous, ...next })) return
  if (req.payload.db.name !== 'mongoose') return
  const { db } = mongoCommerce(req.payload)
  const session = await commerceSession(req)
  const balance = await db
    .collection<InternalRecord>(MONEY.balances)
    .findOne({ _id: String(previous.id) }, { session })
  const hasEntry =
    balance ||
    (await db
      .collection<InternalRecord>(MONEY.entries)
      .findOne({ orderId: String(previous.id) }, { session, projection: { _id: 1 } }))
  if (hasEntry)
    throw new RequestError(
      next
        ? 'Orders with recorded money have locked items, fees and payment method. Record refunds separately.'
        : 'Orders with recorded money cannot be deleted. Cancel and retain the audit trail.',
      409,
    )
}

export async function recordMoney(payload: Payload, user: User, body: Record<string, unknown>) {
  requireOperationsAdmin(user)
  const command = parseMoneyCommand(body)
  const { db, adapter } = await requireMoneyReady(payload)
  const fingerprint = JSON.stringify({ ...command, actorId: String(user.id) })
  return commerceTransaction(
    payload,
    user,
    async (req) => {
      const session = await commerceSession(req)
      const entries = db.collection<InternalRecord>(MONEY.entries)
      const existing = await entries.findOne({ _id: command.key }, { session })
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new RequestError('Submission key was already used for different details.', 409)
        return { id: existing._id, replayed: true }
      }
      const order = await payload.findByID({
        collection: 'orders',
        id: command.orderId,
        user,
        overrideAccess: false,
        depth: 0,
        req,
      })
      // A transactional write fence serializes money entries with all order edits/deletion,
      // including operations that have no knowledge of the private money collections.
      const model = adapter.collections.orders
      const id = model.schema.path('_id').cast(order.id)
      const raw = model.collection
      const fenced = await raw.updateOne(
        { _id: id, __nskiMoneyFence: { $exists: false } },
        {
          $set: { __nskiMoneyFence: randomUUID() },
        },
        { session },
      )
      if (fenced.matchedCount !== 1)
        throw new RequestError('Order is unavailable for money recording.', 409)
      await raw.updateOne({ _id: id }, { $unset: { __nskiMoneyFence: '' } }, { session })
      if (Date.parse(command.occurredAt) < Date.parse(order.createdAt))
        throw new RequestError('Payment time cannot precede order creation.')
      const balances = db.collection<InternalRecord>(MONEY.balances)
      const balance = await balances.findOne({ _id: String(order.id) }, { session })
      const collected = balance?.collectedMinor || 0,
        refunded = balance?.refundedMinor || 0
      const ledger = await entries
        .aggregate(
          [
            { $match: { orderId: String(order.id) } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                collected: {
                  $sum: { $cond: [{ $eq: ['$kind', 'collection'] }, '$amountMinor', 0] },
                },
                refunded: { $sum: { $cond: [{ $eq: ['$kind', 'refund'] }, '$amountMinor', 0] } },
              },
            },
          ],
          { session, maxTimeMS: 10000 },
        )
        .toArray()
      if (
        !Number.isSafeInteger(collected) ||
        !Number.isSafeInteger(refunded) ||
        collected < 0 ||
        refunded < 0 ||
        refunded > collected ||
        Boolean(balance) !== Boolean(ledger[0]?.count) ||
        collected !== (ledger[0]?.collected || 0) ||
        refunded !== (ledger[0]?.refunded || 0)
      )
        throw new RequestError(
          'Money ledger needs reconciliation. Do not reset its balance or resubmit under a new key.',
          409,
        )
      const cap = totalMinor(order.totalAmount)
      if (command.kind === 'collection') {
        if (order.status === 'cancelled')
          throw new RequestError('Cannot record a new collection on a cancelled order.', 422)
        if (collected - refunded + command.amountMinor > cap)
          throw new RequestError('Collection exceeds the remaining recorded order amount.', 422)
      } else {
        const payment = await entries.findOne(
          { _id: command.refundOf, orderId: String(order.id), kind: 'collection' },
          { session },
        )
        if (!payment) throw new RequestError('Choose a collection belonging to this order.')
        if (Date.parse(command.occurredAt) < new Date(payment.occurredAt).getTime())
          throw new RequestError('Refund time cannot precede its collection.')
        const prior = await entries
          .aggregate(
            [
              { $match: { refundOf: command.refundOf, kind: 'refund' } },
              { $group: { _id: null, amount: { $sum: '$amountMinor' } } },
            ],
            { session, maxTimeMS: 10000 },
          )
          .toArray()
        if (
          command.amountMinor > payment.amountMinor - (prior[0]?.amount || 0) ||
          command.amountMinor > collected - refunded
        )
          throw new RequestError('Refund exceeds the unrefunded recorded collection.', 422)
      }
      const now = new Date()
      await entries.insertOne(
        {
          _id: command.key,
          orderId: String(order.id),
          orderNumber: String(order.orderNumber || '').slice(0, 80),
          kind: command.kind,
          amountMinor: command.amountMinor,
          currency: 'PKR',
          method: command.method,
          reason: command.reason,
          occurredAt: new Date(command.occurredAt),
          recordedAt: now,
          refundOf: command.refundOf || null,
          actorId: String(user.id),
          fingerprint,
        },
        { session },
      )
      await balances.updateOne(
        { _id: String(order.id) },
        {
          $set: {
            collectedMinor: collected + (command.kind === 'collection' ? command.amountMinor : 0),
            refundedMinor: refunded + (command.kind === 'refund' ? command.amountMinor : 0),
            updatedAt: now,
          },
          $setOnInsert: { firstRecordedAt: now },
        },
        { upsert: true, session },
      )
      return { id: command.key, replayed: false }
    },
    true,
  )
}
