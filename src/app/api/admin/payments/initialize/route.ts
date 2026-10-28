import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { initializeMoney } from '@/utilities/paymentLedger'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    await initializeMoney(payload, user)
    return privateJSON({ ready: true })
  } catch (error) {
    return requestError(error)
  }
}
