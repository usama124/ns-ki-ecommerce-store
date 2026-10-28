import type { Payload, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { createHash, randomUUID } from 'node:crypto'
import { parseAnalyticsContext } from '@/lib/analytics/context'
import { analyticsConfig } from '@/lib/analytics/model'
import { commerceSession, mongoCommerce, type InternalRecord } from './commerceDatabase'
import { RequestError } from './apiSecurity'

export const ANALYTICS = {
  context: 'nski_analytics_context',
  outbox: 'nski_analytics_outbox',
  revoked: 'nski_analytics_revoked',
} as const
const DAY = 86400000
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function serverAnalyticsEnabled() {
  return (
    process.env.ANALYTICS_SERVER_ENABLED === 'true' &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production') &&
    analyticsConfig(process.env, process.env.NEXT_PUBLIC_SERVER_URL || '').enabled
  )
}

/** Explicit optional deployment initialization. Does not change commerce readiness. */
export async function initializeAnalytics(payload: Payload) {
  const { db } = mongoCommerce(payload)
  for (const name of Object.values(ANALYTICS)) {
    if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext()))
      await db.createCollection(name)
  }
  await db.collection(ANALYTICS.outbox).createIndex({ state: 1, availableAt: 1 })
  await db.collection(ANALYTICS.outbox).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection(ANALYTICS.context).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection(ANALYTICS.revoked).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db
    .collection<InternalRecord>('nski_commerce_config')
    .updateOne({ _id: 'analytics-v1' }, { $set: { ready: true } }, { upsert: true })
}
async function analyticsReady(payload: Payload) {
  const { db } = mongoCommerce(payload)
  return Boolean(
    await db
      .collection<InternalRecord>('nski_commerce_config')
      .findOne({ _id: 'analytics-v1', ready: true }),
  )
}

export async function orderAnalyticsStatus(payload: Payload) {
  const ready = await analyticsReady(payload)
  const states = ['pending', 'processing', 'accepted', 'validated', 'suppressed', 'review'] as const
  const counts: Record<string, number> = {}
  if (ready) {
    const { db } = mongoCommerce(payload)
    const rows = await db
      .collection(ANALYTICS.outbox)
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$state', count: { $sum: 1 } } },
      ])
      .toArray()
    for (const state of states) counts[state] = rows.find((row) => row._id === state)?.count || 0
  }
  return { ready, enabled: serverAnalyticsEnabled(), counts }
}

/** Only allow server-accepted line prices/quantities; never customer/address/proof. */
export function orderAnalyticsEvent(doc: Order, name: 'order_placed' | 'purchase') {
  const items = (doc.items || []).map((line) => ({
    item_id: String(typeof line.product === 'object' ? line.product.id : line.product),
    item_variant: line.variantSize,
    price: line.unitPrice,
    quantity: line.quantity,
  }))
  if (
    !items.length ||
    items.length > 50 ||
    items.some(
      (item) =>
        !item.item_id ||
        item.item_id === 'undefined' ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1,
    )
  )
    return
  const value =
    Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  return {
    name,
    params: {
      transaction_id: String(doc.id),
      currency: 'PKR',
      value,
      items,
      shipping: doc.shippingFee || 0,
      cod_fee: doc.codFee || 0,
      payment_type: doc.paymentMethod,
      // Purchase measures accepted orders, NOT collected cash or net revenue.
      payment_status:
        doc.paymentMethod === 'cod'
          ? 'cod_due'
          : name === 'purchase'
            ? 'transfer_confirmed'
            : 'transfer_pending',
    },
  }
}

/** Called in the order's own transaction. Disabled installs do no additional DB work. */
export async function enqueueOrderAnalytics(
  doc: Order,
  previous: Order | undefined,
  operation: string,
  req: PayloadRequest,
) {
  if (!serverAnalyticsEnabled()) return
  const incoming =
    operation === 'create' ? parseAnalyticsContext(req.context.orderAnalytics) : undefined
  // No legacy backfill and no context for unconsented orders.
  if (operation === 'create' && !incoming) return
  if (!(await analyticsReady(req.payload))) return
  const session = await commerceSession(req)
  const { db } = mongoCommerce(req.payload)
  const contexts = db.collection<InternalRecord>(ANALYTICS.context)
  const now = new Date()
  const orderId = String(doc.id)
  if (
    incoming &&
    (await db
      .collection<InternalRecord>(ANALYTICS.revoked)
      .findOne({ _id: hashToken(incoming.token) }, { session }))
  )
    return
  if (incoming)
    await contexts.updateOne(
      { _id: orderId },
      {
        $setOnInsert: {
          clientId: incoming.clientId,
          sessionId: incoming.sessionId,
          tokenHash: hashToken(incoming.token),
          capturedAt: now,
          expiresAt: new Date(now.getTime() + 3 * DAY),
        },
      },
      { upsert: true, session },
    )
  const context = await contexts.findOne({ _id: orderId, expiresAt: { $gt: now } }, { session })
  if (
    !context ||
    (await db
      .collection<InternalRecord>(ANALYTICS.revoked)
      .findOne({ _id: context.tokenHash }, { session }))
  )
    return
  const names: Array<'order_placed' | 'purchase'> = []
  if (operation === 'create') names.push('order_placed')
  if (
    ['confirmed', 'processing'].includes(doc.status || '') &&
    (operation === 'create' || !['confirmed', 'processing'].includes(previous?.status || ''))
  )
    names.push('purchase')
  for (const name of names) {
    const event = orderAnalyticsEvent(doc, name)
    if (!event) continue
    await db.collection<InternalRecord>(ANALYTICS.outbox).updateOne(
      { _id: `${orderId}:${name}` },
      {
        $setOnInsert: {
          orderId,
          event,
          clientId: context.clientId,
          sessionId: context.sessionId,
          tokenHash: context.tokenHash,
          capturedAt: context.capturedAt,
          createdAt: now,
          availableAt: now,
          expiresAt: new Date(now.getTime() + 30 * DAY),
          state: 'pending',
          attempts: 0,
        },
      },
      { upsert: true, session },
    )
  }
}

/** A random capability can revoke only its own pending events; never a GA client ID. */
export async function revokeOrderAnalytics(payload: Payload, token: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
    throw new RequestError('Invalid analytics preference.')
  if (!(await analyticsReady(payload))) return
  const { db } = mongoCommerce(payload)
  const tokenHash = hashToken(token)
  await db.collection<InternalRecord>(ANALYTICS.revoked).updateOne(
    { _id: tokenHash },
    {
      $set: { expiresAt: new Date(Date.now() + 180 * DAY) },
    },
    { upsert: true },
  )
  await db.collection<InternalRecord>(ANALYTICS.outbox).updateMany(
    { tokenHash, state: { $in: ['pending', 'processing'] } },
    {
      $set: { state: 'suppressed', failure: 'consent_withdrawn' },
      $unset: { clientId: '', sessionId: '' },
    },
  )
  await db.collection<InternalRecord>(ANALYTICS.context).deleteMany({ tokenHash })
}

/** Endpoint acceptance is not GA ingestion. Ambiguous sends are quarantined, not replayed. */
export async function dispatchOrderAnalytics(payload: Payload, maximum = 3) {
  if (!serverAnalyticsEnabled() || !(await analyticsReady(payload)))
    throw new RequestError('Server analytics is disabled or not initialized.', 503)
  const id = process.env.NEXT_PUBLIC_GA4_ID!
  const secret = process.env.GA4_API_SECRET
  const mode = process.env.ANALYTICS_DELIVERY_MODE
  if (!secret || !['validate', 'collect'].includes(mode || ''))
    throw new RequestError('Analytics delivery configuration is incomplete.', 503)
  const { db } = mongoCommerce(payload)
  const outbox = db.collection<InternalRecord>(ANALYTICS.outbox)
  const counts = { accepted: 0, validated: 0, suppressed: 0, review: 0 }
  for (let index = 0; index < Math.min(Math.max(maximum, 0), 3); index++) {
    const now = new Date(),
      lease = randomUUID()
    const job = await outbox.findOneAndUpdate(
      { state: { $in: ['pending', 'processing'] }, availableAt: { $lte: now } },
      [
        {
          $set: {
            state: 'processing',
            lease,
            availableAt: new Date(now.getTime() + 60000),
            attempts: { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
          },
        },
      ],
      { sort: { availableAt: 1 }, returnDocument: 'after' },
    )
    if (!job) break
    const owner = { _id: job._id, lease, state: 'processing' }
    let state = 'review',
      failure: string | undefined
    const age = now.getTime() - new Date(job.createdAt).getTime()
    if (await db.collection<InternalRecord>(ANALYTICS.revoked).findOne({ _id: job.tokenHash })) {
      state = 'suppressed'
      failure = 'consent_withdrawn'
    } else if (age < 0 || age > 70 * 3600000) {
      state = 'suppressed'
      failure = 'event_expired'
    } else if (job.attempts > 1) {
      failure = 'ambiguous_previous_attempt'
    } else {
      const event = { name: job.event.name, params: { ...job.event.params } }
      // Do not attach delayed confirmations to an old shopping session.
      const sessionAge = now.getTime() - Number(job.sessionId) * 1000
      if (
        sessionAge >= 0 &&
        sessionAge < DAY &&
        now.getTime() - new Date(job.capturedAt).getTime() < DAY
      )
        event.params.session_id = Number(job.sessionId)
      const body = {
        client_id: job.clientId,
        timestamp_micros: new Date(job.createdAt).getTime() * 1000,
        consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
        events: [event],
        ...(mode === 'validate' ? { validation_behavior: 'ENFORCE_RECOMMENDATIONS' } : {}),
      }
      try {
        const url = new URL(
          `https://www.google-analytics.com/${mode === 'validate' ? 'debug/' : ''}mp/collect`,
        )
        url.searchParams.set('measurement_id', id)
        url.searchParams.set('api_secret', secret)
        const response = await fetch(url, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) failure = 'provider_rejected'
        else if (mode === 'validate') {
          const result = await response.json()
          if (Array.isArray(result.validationMessages) && result.validationMessages.length === 0)
            state = 'validated'
          else failure = 'validation_failed'
        } else state = 'accepted'
      } catch {
        failure = 'delivery_not_confirmed'
      }
    }
    await outbox.updateOne(owner, {
      $set: { state, ...(failure ? { failure } : {}), finishedAt: new Date() },
      $unset: { lease: '', clientId: '', sessionId: '' },
    })
    counts[state as keyof typeof counts]++
  }
  return counts
}
