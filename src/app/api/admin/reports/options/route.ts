import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(request)
    const [products, categories] = await Promise.all([
      payload.find({
        collection: 'products',
        user,
        overrideAccess,
        depth: 0,
        limit: 200,
        sort: 'title',
        select: { title: true },
      }),
      payload.find({
        collection: 'categories',
        user,
        overrideAccess,
        depth: 0,
        limit: 200,
        sort: 'name',
        select: { name: true },
      }),
    ])
    return privateJSON({
      products: products.docs.map((doc) => ({ id: String(doc.id), title: doc.title })),
      categories: categories.docs.map((doc) => ({ id: String(doc.id), title: doc.name })),
      limited: products.hasNextPage || categories.hasNextPage,
    })
  } catch (error) {
    return requestError(error)
  }
}
