import { revalidatePath, revalidateTag } from 'next/cache.js'
import type { GlobalAfterChangeHook } from 'payload'

export const revalidateSiteSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  if (!req.context?.disableRevalidate) {
    try {
      revalidateTag('global_site-settings', { expire: 0 })
      revalidateTag('storefront-shell', { expire: 0 })
      revalidatePath('/', 'layout')
    } catch {
      // CLI/seed execution has no Next request cache; the normal cache TTL still applies.
      req.payload.logger.warn('Site settings saved; storefront cache invalidation was unavailable.')
    }
  }
  return doc
}
