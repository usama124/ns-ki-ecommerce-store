import { privateJSON, readJSON, RequestError, requestError, requireAdmin, validDocumentID } from '@/utilities/apiSecurity'
import { bookInstaOrder, instaAdminState } from '@/utilities/instaworld'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    const id = new URL(request.url).searchParams.get('orderId')
    if (!validDocumentID(id)) throw new RequestError('A valid order ID is required.')
    return privateJSON(await instaAdminState(payload, user, id, false))
  } catch (error) { return requestError(error) }
}
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    const body = await readJSON(request)
    if (!validDocumentID(body.orderId)) throw new RequestError('A valid order ID is required.')
    if (body.action === 'book') {
      if (body.confirm !== true) throw new RequestError('Confirm that this action books a real shipment and may incur courier charges.')
      await bookInstaOrder(payload, user, body.orderId, body)
    } else if (body.action !== 'refresh') throw new RequestError('Invalid shipment action.')
    return privateJSON(await instaAdminState(payload, user, body.orderId, body.action === 'refresh'))
  } catch (error) { return requestError(error) }
}
