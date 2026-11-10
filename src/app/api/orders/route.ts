import config from '@payload-config'
import { getPayload } from 'payload'
import { privateJSON, RequestError, requestError, requireSameOrigin } from '@/utilities/apiSecurity'
import { readCheckoutRequest, validateCheckoutReceipt, attachCheckoutReceipt } from '@/utilities/checkoutReceipt'
import { parseCheckout } from '@/utilities/checkoutQuote'
import { signOrderAccess } from '@/utilities/orderAccess'
import { checkoutKey, executeCheckout } from '@/utilities/checkoutCommand'
import { enforceRequestLimit } from '@/utilities/requestLimits'
import { sendCheckoutEmails } from '@/utilities/checkoutEmailDelivery'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    requireSameOrigin(req)
    const key = checkoutKey(req.headers.get('idempotency-key'))
    const { body, receipt } = await readCheckoutRequest(req)
    const input = parseCheckout(body)
    if (input.paymentMethod !== 'cod' && !receipt)
      throw new RequestError('Upload your payment receipt before completing the order.')
    const payload = await getPayload({ config })
    await enforceRequestLimit(payload, req.headers, 'checkout', input.customer.phone.replace(/\D/g, ''))
    const { user } = await payload.auth({ headers: req.headers })
    const image = input.paymentMethod !== 'cod' && receipt ? await validateCheckoutReceipt(receipt) : null
    const result = await executeCheckout(payload, input, body.expectedTotal, key, user, body.analytics)
    // A changed quote requires a new, explicit confirmation from the customer.
    // The supplied amount is only a confirmation token, never the stored price.
    if ('quote' in result) {
      return privateJSON({ error: 'Please review and confirm the current order total.', code: 'QUOTE_CHANGED', quote: result.quote }, 409)
    }
    // The order exists even if receipt storage subsequently needs recovery.
    sendCheckoutEmails(payload, result.orderId)
    if (image) {
      try { await attachCheckoutReceipt(result.orderId, image) }
      catch {
        // The order/stock transaction has committed. Preserve its retry identity;
        // never imply rollback or encourage a new checkout key.
        return privateJSON({
          success: false, code: 'RECEIPT_UPLOAD_PENDING',
          error: 'Your order is saved, but receipt upload is not confirmed. Retry with the same checkout details to finish; do not place another order.',
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          accessToken: signOrderAccess(result.orderId, payload.config.secret),
        }, 503)
      }
    }
    // executeCheckout has committed (or returned a committed idempotent replay).
    // Only this order's due, unsent jobs are eligible; failed sends stay queued.
    return privateJSON({ success: true, ...result,
      accessToken: signOrderAccess(result.orderId, payload.config.secret) })
  } catch (error) { return requestError(error) }
}
