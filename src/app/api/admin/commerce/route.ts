import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { COMMERCE, requireCommerceReady } from '@/utilities/commerceDatabase'

export async function GET(request: Request) {
  try {
    const { payload } = await requireAdmin(request)
    const { db } = await requireCommerceReady(payload)
    const collection = db.collection(COMMERCE.outbox)
    const states: Record<string, number> = {}
    for (const state of ['pending', 'processing', 'sent', 'dead'])
      states[state] = await collection.countDocuments({ state })
    return privateJSON({ emailOutbox: states })
  } catch (error) {
    return requestError(error)
  }
}
