import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { operationsStatus } from '@/lib/reports/operations'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    return privateJSON(await operationsStatus(payload, user))
  } catch (error) {
    return requestError(error)
  }
}
