import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { moneyStatus } from '@/utilities/paymentLedger'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    return privateJSON(await moneyStatus(payload, user))
  } catch (error) {
    return requestError(error)
  }
}
