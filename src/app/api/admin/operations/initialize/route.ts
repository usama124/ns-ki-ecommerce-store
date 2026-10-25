import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { initializeOperations } from '@/utilities/operationsHistory'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    await initializeOperations(payload, user)
    return privateJSON({ ready: true })
  } catch (error) {
    return requestError(error)
  }
}
