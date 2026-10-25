import { privateJSON, requestError, requireAdmin, RequestError } from '@/utilities/apiSecurity'
import { dispatchOrderAnalytics } from '@/utilities/orderAnalytics'
import { timingSafeEqual } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { payload } = await requireAdmin(request)
    return privateJSON(await dispatchOrderAnalytics(payload))
  } catch (error) {
    return requestError(error)
  }
}
export async function GET(request: Request) {
  try {
    const secret = process.env.ANALYTICS_WORKER_SECRET || ''
    const supplied = request.headers.get('authorization') || ''
    const expected = `Bearer ${secret}`
    if (
      secret.length < 32 ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      throw new RequestError('Action forbidden.', 403)
    return privateJSON(await dispatchOrderAnalytics(await getPayload({ config })))
  } catch (error) {
    return requestError(error)
  }
}
