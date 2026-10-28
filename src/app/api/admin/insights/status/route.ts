import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { insightStatus } from '@/lib/reports/insights'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    return privateJSON(await insightStatus(payload, user))
  } catch (error) {
    return requestError(error)
  }
}
