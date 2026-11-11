import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { instaReferences } from '@/utilities/instaworldClient'
export async function GET(request: Request) {
  try { await requireAdmin(request); return privateJSON(await instaReferences()) }
  catch (error) { return requestError(error) }
}
