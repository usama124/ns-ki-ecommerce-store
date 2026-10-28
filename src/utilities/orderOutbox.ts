import type { Payload, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { randomUUID } from 'node:crypto'
import {
  COMMERCE,
  commerceSession,
  mongoCommerce,
  requireCommerceReady,
  type InternalRecord,
} from './commerceDatabase'
import { RequestError } from './apiSecurity'
import {
  getNewOrderAdminAlertEmailHtml,
  getOrderPlacedCustomerEmailHtml,
  getPaymentConfirmedCustomerEmailHtml,
  getOrderRejectedCustomerEmailHtml,
  getOrderShippedCustomerEmailHtml,
} from './emailTemplates'

type EmailKind = 'admin' | 'placed' | 'confirmed' | 'cancelled' | 'shipped'
export async function enqueueOrderEmails(
  doc: Order,
  previous: Order | undefined,
  operation: string,
  req: PayloadRequest,
) {
  const kinds: EmailKind[] = []
  if (operation === 'create') {
    kinds.push('admin')
    kinds.push(doc.status === 'confirmed' ? 'confirmed' : 'placed')
  } else if (doc.status !== previous?.status) {
    if (
      ['confirmed', 'processing'].includes(doc.status || '') &&
      !['confirmed', 'processing'].includes(previous?.status || '')
    )
      kinds.push('confirmed')
    else if (doc.status === 'cancelled') kinds.push('cancelled')
    else if (doc.status === 'shipped') kinds.push('shipped')
  }
  if (!kinds.length) return
  const session = await commerceSession(req)
  const url = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const templates = {
    admin: getNewOrderAdminAlertEmailHtml,
    placed: getOrderPlacedCustomerEmailHtml,
    confirmed: getPaymentConfirmedCustomerEmailHtml,
    cancelled: getOrderRejectedCustomerEmailHtml,
    shipped: getOrderShippedCustomerEmailHtml,
  }
  for (const kind of kinds) {
    if (kind !== 'admin' && !doc.customer?.email) continue
    await mongoCommerce(req.payload)
      .db.collection<InternalRecord>(COMMERCE.outbox)
      .insertOne(
        {
          _id: randomUUID(),
          orderId: String(doc.id),
          kind,
          state: 'pending',
          attempts: 0,
          createdAt: new Date(),
          availableAt: new Date(),
          customerEmail: kind === 'admin' ? undefined : doc.customer?.email,
          subject: `N's KI ${kind === 'admin' ? 'New order' : `Order ${kind}`} - ${doc.orderNumber}`,
          html: templates[kind](
            {
              ...doc,
              status: doc.status || undefined,
              customer: { ...doc.customer, email: doc.customer?.email || undefined },
              items:
                doc.items?.map((item) => ({
                  ...item,
                  variantSku: item.variantSku || undefined,
                  variantColor: item.variantColor || undefined,
                })) || undefined,
              fulfillment: doc.fulfillment
                ? {
                    courierName: doc.fulfillment.courierName || undefined,
                    trackingNumber: doc.fulfillment.trackingNumber || undefined,
                    trackingUrl: doc.fulfillment.trackingUrl || undefined,
                  }
                : undefined,
              codFee: doc.codFee ?? undefined,
              cancellationReason: doc.cancellationReason || undefined,
              notes: kind === 'admin' ? doc.notes || undefined : undefined,
            },
            url,
          ),
        },
        { session },
      )
  }
}

/** Provider acceptance is not proof of inbox delivery. Never log email bodies/recipients. */
export async function dispatchOrderEmails(payload: Payload, maximum = 3, orderId?: string | number) {
  const { db } = await requireCommerceReady(payload)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL
  const admin = process.env.ADMIN_EMAIL
  if (!apiKey || !from || !admin)
    throw new RequestError('Email delivery configuration is incomplete.', 503)
  const outbox = db.collection<InternalRecord>(COMMERCE.outbox)
  const counts = { sent: 0, retried: 0, dead: 0 }
  for (let index = 0; index < Math.min(maximum, 3); index++) {
    const now = new Date()
    const lease = randomUUID()
    const job = await outbox.findOneAndUpdate(
      {
        state: { $in: ['pending', 'processing'] },
        availableAt: { $lte: now },
        ...(orderId !== undefined ? { orderId: String(orderId) } : {}),
      },
      [
        {
          $set: {
            state: 'processing',
            lease,
            availableAt: new Date(now.getTime() + 60_000),
            attempts: { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
            firstAttemptAt: { $ifNull: ['$firstAttemptAt', now] },
          },
        },
      ],
      { sort: { availableAt: 1 }, returnDocument: 'after' },
    )
    if (!job) break
    const owner = { _id: job._id, lease }
    // Resend deduplication expires after 24h. An ambiguous old send needs human
    // review, not an automatic resend outside that window.
    if (
      job.attempts > 6 ||
      now.getTime() - new Date(job.firstAttemptAt).getTime() > 23 * 3600_000
    ) {
      await outbox.updateOne(owner, {
        $set: { state: 'dead', failure: 'manual_review_required' },
        $unset: { lease: '' },
      })
      counts.dead++
      continue
    }
    const delivery = job.delivery || {
      from: `N's KI <${from}>`,
      to: job.kind === 'admin' ? admin : job.customerEmail,
      subject: job.subject,
      html: job.html,
    }
    if (!job.delivery) await outbox.updateOne(owner, { $set: { delivery } })
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `nski-outbox-${job._id}`,
        },
        body: JSON.stringify(delivery),
      })
      if (!response.ok) throw new Error('provider_rejected')
      const result = await response.json()
      if (typeof result.id !== 'string') throw new Error('provider_response_invalid')
      await outbox.updateOne(owner, {
        $set: { state: 'sent', sentAt: new Date(), providerId: result.id },
        $unset: { lease: '', failure: '' },
      })
      counts.sent++
    } catch {
      const dead = job.attempts >= 6
      await outbox.updateOne(owner, {
        $set: {
          state: dead ? 'dead' : 'pending',
          failure: 'delivery_not_confirmed',
          availableAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** (job.attempts - 1))),
        },
        $unset: { lease: '' },
      })
      counts[dead ? 'dead' : 'retried']++
    }
  }
  return counts
}
