import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

// Shared navigation/category hierarchy: no product stock or customer data is cached here.
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
