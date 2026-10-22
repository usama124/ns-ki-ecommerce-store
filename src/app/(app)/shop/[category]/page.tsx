import { ProductGrid } from '@/components/products/ProductGrid'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { getStorefrontCategories } from '@/utilities/getStorefrontCategories'
import { productCardSelect } from '@/utilities/productCardSelect'
import { categoryProductFilter } from '@/utilities/categoryProductFilter'
import { ProductPagination, productPage } from '@/components/products/ProductPagination'
import { CollectionHeading } from '@/components/products/CollectionHeading'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    category: string
  }>
  searchParams: Promise<{
    category?: string
    sort?: string
    q?: string
    page?: string
  }>
}

export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  const { category: categorySlug } = await params
  const { category: queryCategory } = (await searchParams) || {}
  const activeCategoryIdentifier = queryCategory || categorySlug

  try {
    const categories = await getStorefrontCategories()
    const cat = categories.find((category) => String(category.id) === activeCategoryIdentifier || category.slug === activeCategoryIdentifier)
    if (!cat) return { title: 'Collection | Siblings by N’s KI' }

    return {
      title: `${cat.name} Collection | Siblings by N’s KI`,
      description: `Shop luxury ${cat.name} from Siblings by N’s KI with express nationwide delivery.`,
    }
  } catch {
    return { title: 'Collection | Siblings by N’s KI' }
  }
}

export default async function CategoryPage({ params, searchParams }: Args) {
  const { category: categorySlug } = await params
  const { category: queryCategory, sort: sortQuery, q, page: pageQuery } = (await searchParams) || {}
  const page = productPage(pageQuery)
  let totalPages = 1
  let totalProducts = 0
  const activeCategoryIdentifier = queryCategory || categorySlug

  let targetCategory: any = null
  let products: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    const categories = await getStorefrontCategories()
    targetCategory = categories.find((category) => String(category.id) === activeCategoryIdentifier || category.slug === activeCategoryIdentifier)

    let payloadSort = 'title'
    if (sortQuery === '-createdAt') payloadSort = '-createdAt'
    else if (sortQuery === 'priceInUSD') payloadSort = 'basePricePKR'
    else if (sortQuery === '-priceInUSD') payloadSort = '-basePricePKR'

    if (targetCategory) {
      const productsResult = await payload.find({
        collection: 'products',
        where: {
          and: [
            { status: { equals: 'published' } },
            categoryProductFilter(categories, targetCategory.id),
          ],
        },
        sort: payloadSort,
        limit: 50,
        page,
        depth: 1,
        select: productCardSelect,
        overrideAccess: false,
      })

      products = productsResult.docs
      totalProducts = productsResult.totalDocs ?? products.length
      totalPages = productsResult.totalPages || 1
    }
  } catch (error) {
    console.error('Category lookup failed', error)
    throw error
  }

  if (!targetCategory) return notFound()

  return (
    <div className="min-h-screen pb-24 sm:pb-12">
      <CollectionHeading title={targetCategory.name} description={targetCategory.description} count={totalProducts} />
      <div className="w-full max-w-7xl mx-auto">
        {products.length === 0 ? (
          <div className="text-center py-20 px-4 glass-card border border-dashed border-border rounded-xl shadow-xs max-w-2xl mx-auto">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-6">
              No products currently available in the &quot;{targetCategory.name}&quot; collection.
            </p>
            <Link
              href="/shop"
              className="inline-block glass-button-primary px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] rounded-lg shadow-xs"
            >
              Browse All Collections
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
        <ProductPagination page={page} totalPages={totalPages} pathname={`/shop/${encodeURIComponent(categorySlug)}`} query={{ category: queryCategory, sort: sortQuery, q }} />
      </div>
    </div>
  )
}
