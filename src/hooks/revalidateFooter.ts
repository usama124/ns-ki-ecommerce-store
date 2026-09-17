import { revalidatePath, revalidateTag } from 'next/cache.js'
import type { GlobalAfterChangeHook } from 'payload'

export const revalidateFooter: GlobalAfterChangeHook = ({ doc, req: { payload } }) => {
  payload.logger.info(`Revalidating footer global...`)
  try {
    revalidateTag('global_footer', 'max')
    revalidatePath('/', 'layout')
  } catch (err) {
    payload.logger.error(`Error revalidating footer: ${err}`)
  }
  return doc
}
