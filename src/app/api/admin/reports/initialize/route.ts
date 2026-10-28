import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { initializeReports } from '@/lib/reports/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    await initializeReports(payload, user)
    return privateJSON({ ready: true })
  } catch (error) {
    return requestError(error)
  }
}
