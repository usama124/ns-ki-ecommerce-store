import {
  privateJSON,
  requestError,
  requireAdmin,
  readJSON,
  RequestError,
  validDocumentID,
} from '@/utilities/apiSecurity'
import { captureInventoryBaselines } from '@/utilities/operationsHistory'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    const body = await readJSON(request, 1024)
    if (body.cursor !== undefined && body.cursor !== '' && !validDocumentID(body.cursor))
      throw new RequestError('Invalid baseline cursor.')
    return privateJSON(await captureInventoryBaselines(payload, user, String(body.cursor || '')))
  } catch (error) {
    return requestError(error)
  }
}
