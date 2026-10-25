import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { orderAnalyticsStatus } from '@/utilities/orderAnalytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const { payload } = await requireAdmin(request)
    return privateJSON(await orderAnalyticsStatus(payload))
  } catch (error) {
    return requestError(error)
  }
}
