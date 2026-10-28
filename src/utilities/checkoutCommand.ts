import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { createHash, createHmac, randomInt } from 'node:crypto'
import {
  COMMERCE,
  commerceSession,
  commerceTransaction,
  mongoCommerce,
  type InternalRecord,
} from './commerceDatabase'
import { parseCheckout, quoteCheckout } from './checkoutQuote'
import { RequestError } from './apiSecurity'
import { parseAnalyticsContext } from '@/lib/analytics/context'

export function checkoutKey(value: string | null) {
  if (
    !value ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
  )
    throw new RequestError(
      'A valid checkout retry key is required. Refresh checkout and try again.',
    )
  return createHash('sha256').update(`nski:checkout:v1:${value.toLowerCase()}`).digest('hex')
}

export async function executeCheckout(
  payload: Payload,
  input: ReturnType<typeof parseCheckout>,
  expectedTotal: unknown,
  key: string,
  user?: User | null,
  analytics?: unknown,
): Promise<
  | { quote: Awaited<ReturnType<typeof quoteCheckout>> }
  | { orderId: string | number; orderNumber: string; replayed: boolean }
> {
  const normalized = {
    ...input,
    lines: [...input.lines].sort((a, b) =>
      `${a.productId}:${a.variantSize.toLowerCase()}`.localeCompare(
        `${b.productId}:${b.variantSize.toLowerCase()}`,
      ),
    ),
  }
  const fingerprint = createHmac('sha256', payload.config.secret)
    .update(JSON.stringify({ input: normalized, expectedTotal, account: user?.id || null }))
    .digest('hex')
  return commerceTransaction<
    | { quote: Awaited<ReturnType<typeof quoteCheckout>> }
    | { orderId: string | number; orderNumber: string; replayed: boolean }
  >(
    payload,
    user,
    async (req) => {
      const session = await commerceSession(req)
      const requests = mongoCommerce(payload).db.collection<InternalRecord>(COMMERCE.checkout)
      const previous = await requests.findOne({ _id: key }, { session })
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new RequestError(
            'This checkout key was used with different details. Please contact support before starting another order.',
            409,
          )
        return {
          orderId: previous.orderId as string | number,
          orderNumber: previous.orderNumber as string,
          replayed: true,
        }
      }
      const quote = await quoteCheckout(payload, input, req)
      if (expectedTotal !== quote.totalAmount) return { quote }
      // The unique _id is claimed in the SAME transaction as order, stock and outbox.
      await requests.insertOne({ _id: key, fingerprint, createdAt: new Date() }, { session })
      // Optional attribution is not part of retry identity and is never returned.
      req.context ||= {}
      req.context.orderAnalytics = parseAnalyticsContext(analytics)
      const order = await payload.create({
        collection: 'orders',
        overrideAccess: true,
        draft: false,
        req,
        data: {
          orderNumber: `#NKI-${randomInt(100000, 1000000)}`,
          customer: input.customer,
          ...(user ? { customerAccount: user.id } : {}),
          items: quote.items,
          paymentMethod: input.paymentMethod,
          paymentProof: input.paymentProof,
          subtotal: quote.subtotal,
          shippingFee: quote.shippingFee,
          codFee: quote.codFee,
          totalAmount: quote.totalAmount,
          status: input.paymentMethod === 'cod' ? 'confirmed' : 'pending_verification',
        },
      })
      await requests.updateOne(
        { _id: key },
        { $set: { orderId: order.id, orderNumber: order.orderNumber } },
        { session },
      )
      return { orderId: order.id, orderNumber: order.orderNumber, replayed: false }
    },
    true,
  )
}
