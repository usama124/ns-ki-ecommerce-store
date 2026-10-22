import { ProductGrid } from '@/components/products/ProductGrid'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { getStorefrontCategories } from '@/utilities/getStorefrontCategories'
import { productCardSelect } from '@/utilities/productCardSelect'
import { categoryProductFilter } from '@/utilities/categoryProductFilter'
import { ProductPagination, productPage } from '@/components/products/ProductPagination'
import { CollectionHeading } from '@/components/products/CollectionHeading'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'All Products | Siblings by N’s KI',
  description:
    'Browse all luxury Pakistani unstitched and pret collections with express nationwide delivery.',
}

type Args = {
  searchParams: Promise<{
    category?: string
    sort?: string
    q?: string
    page?: string
  }>
}

export default async function ShopPage({ searchParams }: Args) {
  const { category: queryCategory, sort: sortQuery, q, page: pageQuery } = (await searchParams) || {}
  const page = productPage(pageQuery)
  let totalPages = 1
  let products: any[] = []
  let totalProducts = 0
  let selectedCategory: any = null

  try {
    const payload = await getPayload({ config: configPromise })

    const categories = await getStorefrontCategories()

    if (queryCategory) {
      selectedCategory = categories.find((category) =>
        String(category.id) === queryCategory || category.slug === queryCategory,
      ) || null
    }

    let payloadSort = 'title'
    if (sortQuery === '-createdAt') payloadSort = '-createdAt'
    else if (sortQuery === 'priceInUSD') payloadSort = 'basePricePKR'
    else if (sortQuery === '-priceInUSD') payloadSort = '-basePricePKR'

    const whereConditions: any[] = [{ status: { equals: 'published' } }]
    if (q?.trim()) whereConditions.push({ title: { contains: q.trim().slice(0, 100) } })
    if (selectedCategory) {
      whereConditions.push(categoryProductFilter(categories, selectedCategory.id))
    }

    const productsResult = await payload.find({
      collection: 'products',
      where: {
        and: whereConditions,
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
  } catch (error) {
    console.error('Shop data loading failed', error)
    throw error
  }

  const pageTitle = selectedCategory ? selectedCategory.name : 'All Products'

  return (
    <div className="min-h-screen pb-24 sm:pb-12">
      <CollectionHeading title={pageTitle} description={selectedCategory?.description} count={totalProducts} />
      <div className="w-full max-w-7xl mx-auto">
        <ProductGrid products={products} emptyMessage="No products found in the catalog yet." />
        <ProductPagination page={page} totalPages={totalPages} pathname="/shop" query={{ category: queryCategory, sort: sortQuery, q }} />
      </div>
    </div>
  )
}
