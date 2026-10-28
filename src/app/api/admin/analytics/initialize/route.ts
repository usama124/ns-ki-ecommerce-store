import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { initializeAnalytics } from '@/utilities/orderAnalytics'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { payload } = await requireAdmin(request)
    await initializeAnalytics(payload)
    return privateJSON({ ready: true })
  } catch (error) {
    return requestError(error)
  }
}
