import config from '@payload-config'
import { getPayload } from 'payload'
import { checkRole } from '@/access/utilities'
import {
  privateJSON,
  RequestError,
  requestError,
  requireSameOrigin,
  validDocumentID,
} from '@/utilities/apiSecurity'
import { verifyOrderAccess } from '@/utilities/orderAccess'
import {
  loadReceipt,
  readReceipt,
  receiptExists,
  receiptStorage,
  storeReceipt,
} from '@/utilities/privateReceipts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

async function authorize(request: Request, context: Context) {
  const { id } = await context.params
  if (!validDocumentID(id)) throw new RequestError('Order unavailable.', 404)
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  // Header for fetch; query parameter is only needed for an inline image/new-tab view.
  const token =
    request.headers.get('x-order-token') || new URL(request.url).searchParams.get('token')
  const guest = verifyOrderAccess(id, token, payload.config.secret)
  if (!user && !guest) throw new RequestError('Order unavailable.', 404)
  let order
  try {
    order = await payload.findByID({
      collection: 'orders',
      id,
      user,
      overrideAccess: guest,
      depth: 0,
      select: { status: true, paymentMethod: true },
    })
  } catch {
    throw new RequestError('Order unavailable.', 404)
  }
  if (!order) throw new RequestError('Order unavailable.', 404)
  // SQL leading-zero IDs / alternate ObjectId casing must not create aliases
  // that bypass the one-receipt-per-order conditional write.
  return { id: order.id, order, admin: checkRole(['admin'], user) }
}

export async function GET(request: Request, context: Context) {
  try {
    const { id, order, admin } = await authorize(request, context)
    if (new URL(request.url).searchParams.get('info') === '1') {
      const exists = await receiptExists(id)
      return privateJSON({
        exists,
        canUpload:
          !exists &&
          !admin &&
          order.paymentMethod !== 'cod' &&
          order.status === 'pending_verification',
      })
    }
    const image = await loadReceipt(id)
    return new Response(Buffer.from(image), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Disposition': 'inline; filename="payment-receipt.webp"',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch (error) {
    return requestError(error)
  }
}

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    const { id, order, admin } = await authorize(request, context)
    if (admin || order.paymentMethod === 'cod' || order.status !== 'pending_verification')
      throw new RequestError(
        'Receipts can only be attached to a digital order awaiting verification.',
        403,
      )
    // Fail closed before decoding if the separate bucket is not configured.
    const storage = receiptStorage()
    storage.client.destroy()
    if (await receiptExists(id)) throw new RequestError('A receipt is already attached.', 409)
    const image = await readReceipt(request)
    await storeReceipt(id, image)
    return privateJSON({ success: true }, 201)
  } catch (error) {
    return requestError(error)
  }
}
