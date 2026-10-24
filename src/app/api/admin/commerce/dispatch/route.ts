import { privateJSON, requestError, requireAdmin, RequestError } from '@/utilities/apiSecurity'
import { dispatchOrderEmails } from '@/utilities/orderOutbox'
import { getPayload } from 'payload'
import config from '@payload-config'
import { timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { payload } = await requireAdmin(request)
    return privateJSON(await dispatchOrderEmails(payload))
  } catch (error) {
    return requestError(error)
  }
}

/** Scheduler must supply its own server-only capability; no cookie/URL secret. */
export async function GET(request: Request) {
  try {
    const secret = process.env.COMMERCE_WORKER_SECRET || ''
    const provided = request.headers.get('authorization') || ''
    const expected = `Bearer ${secret}`
    if (
      secret.length < 32 ||
      Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    )
      throw new RequestError('Action forbidden.', 403)
    const payload = await getPayload({ config })
    return privateJSON(await dispatchOrderEmails(payload))
  } catch (error) {
    return requestError(error)
  }
}
