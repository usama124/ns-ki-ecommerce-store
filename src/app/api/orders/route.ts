import config from '@payload-config'
import { getPayload } from 'payload'
import { privateJSON, readJSON, requestError, requireSameOrigin } from '@/utilities/apiSecurity'
import { parseCheckout, quoteCheckout } from '@/utilities/checkoutQuote'
import { signOrderAccess } from '@/utilities/orderAccess'
import { randomInt } from 'node:crypto'

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const body = await readJSON(req)
    const input = parseCheckout(body)
    const payload = await getPayload({ config })
    const quote = await quoteCheckout(payload, input)
    // A changed quote requires a new, explicit confirmation from the customer.
    // The supplied amount is only a confirmation token, never the stored price.
    if (body.expectedTotal !== quote.totalAmount) {
      return privateJSON({ error: 'Please review and confirm the current order total.', code: 'QUOTE_CHANGED', quote }, 409)
    }
    const { user } = await payload.auth({ headers: req.headers })
    const order = await payload.create({
      collection: 'orders',
      // This is the single public server command. Generic collection creation is
      // admin-only. No request object is spread into the privileged write.
      overrideAccess: true,
      draft: false,
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
    return privateJSON({ success: true, orderNumber: order.orderNumber, orderId: order.id,
      accessToken: signOrderAccess(order.id, payload.config.secret) })
  } catch (error) { return requestError(error) }
}
