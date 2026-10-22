import type { Plugin } from 'payload'
import { revalidateTag } from 'next/cache'

function invalidateShell({ doc, req }: any) {
  if (!req.context?.disableRevalidate) {
    try {
      revalidateTag('storefront-shell', { expire: 0 })
    } catch {
      // CLI operations have no Next cache context; the 60s TTL remains a fallback.
    }
  }
  return doc
}

export const storefrontCachePlugin: Plugin = (config) => ({
  ...config,
  collections: config.collections?.map((collection) =>
    collection.slug === 'categories'
      ? {
          ...collection,
          hooks: {
            ...collection.hooks,
            afterChange: [...(collection.hooks?.afterChange || []), invalidateShell],
            afterDelete: [...(collection.hooks?.afterDelete || []), invalidateShell],
          },
        }
      : collection,
  ),
  globals: config.globals?.map((global) => ({
    ...global,
    hooks: {
      ...global.hooks,
      afterChange: [...(global.hooks?.afterChange || []), invalidateShell],
    },
  })),
})
