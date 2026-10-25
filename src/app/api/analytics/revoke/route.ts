import { privateJSON, readJSON, requestError, requireSameOrigin } from '@/utilities/apiSecurity'
import { revokeOrderAnalytics } from '@/utilities/orderAnalytics'
import { enforceRequestLimit } from '@/utilities/requestLimits'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const body = await readJSON(request, 1024)
    const payload = await getPayload({ config })
    await enforceRequestLimit(
      payload,
      request.headers,
      'analytics-revoke',
      typeof body.token === 'string' ? body.token : '',
    )
    await revokeOrderAnalytics(payload, body.token)
    return privateJSON({ saved: true })
  } catch (error) {
    return requestError(error)
  }
}
