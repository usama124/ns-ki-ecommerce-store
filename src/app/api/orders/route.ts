import config from '@payload-config'
import { getPayload } from 'payload'
import { privateJSON, readJSON, requestError, requireSameOrigin } from '@/utilities/apiSecurity'
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
    const body = await readJSON(req)
    const input = parseCheckout(body)
    const payload = await getPayload({ config })
    await enforceRequestLimit(payload, req.headers, 'checkout', input.customer.phone.replace(/\D/g, ''))
    const { user } = await payload.auth({ headers: req.headers })
    const result = await executeCheckout(payload, input, body.expectedTotal, key, user, body.analytics)
    // A changed quote requires a new, explicit confirmation from the customer.
    // The supplied amount is only a confirmation token, never the stored price.
    if ('quote' in result) {
      return privateJSON({ error: 'Please review and confirm the current order total.', code: 'QUOTE_CHANGED', quote: result.quote }, 409)
    }
    // executeCheckout has committed (or returned a committed idempotent replay).
    // Only this order's due, unsent jobs are eligible; failed sends stay queued.
    sendCheckoutEmails(payload, result.orderId)
    return privateJSON({ success: true, ...result,
      accessToken: signOrderAccess(result.orderId, payload.config.secret) })
  } catch (error) { return requestError(error) }
}
