import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { initializeInsights } from '@/lib/reports/insights'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    await initializeInsights(payload, user)
    return privateJSON({ ready: true })
  } catch (error) {
    return requestError(error)
  }
}
