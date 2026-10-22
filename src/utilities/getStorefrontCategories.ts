import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

// Navigation only: no product stock or customer data is persisted in this cache.
export const getStorefrontCategories = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'categories',
      sort: 'name',
      depth: 0,
      pagination: false,
      overrideAccess: false,
      select: { name: true, slug: true, type: true, parent: true, description: true },
    })
    return result.docs
  },
  ['storefront-categories'],
  { tags: ['storefront-shell'], revalidate: 60 },
)
