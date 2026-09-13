import { GridTileImage } from '@/components/Grid/tile'
import { Price } from '@/components/Price'
import configPromise from '@payload-config'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "All Products | N's KI Pakistani Luxury Fashion",
  description:
    'Browse all luxury Pakistani unstitched and pret collections with express nationwide delivery.',
}

type Args = {
  searchParams: Promise<{
    category?: string
    sort?: string
    q?: string
  }>
}

export default async function ShopPage({ searchParams }: Args) {
  const { category: queryCategory, sort: sortQuery } = (await searchParams) || {}
  let products: any[] = []
  let mainCategories: any[] = []
  let selectedCategory: any = null

  try {
    const payload = await getPayload({ config: configPromise })

    const categoriesResult = await payload.find({
      collection: 'categories',
      where: { type: { equals: 'main' } },
      limit: 20,
    })
    mainCategories = categoriesResult.docs

    if (queryCategory) {
      const isNumeric = /^\d+$/.test(queryCategory)
      const catResult = await payload.find({
        collection: 'categories',
        where: isNumeric
          ? { id: { equals: Number(queryCategory) } }
          : { slug: { equals: queryCategory } },
        limit: 1,
      })
      selectedCategory = catResult.docs?.[0] || null
    }

    let payloadSort = 'title'
    if (sortQuery === '-createdAt') payloadSort = '-createdAt'
    else if (sortQuery === 'priceInUSD') payloadSort = 'basePricePKR'
    else if (sortQuery === '-priceInUSD') payloadSort = '-basePricePKR'

    const whereConditions: any[] = [{ status: { equals: 'published' } }]
    if (selectedCategory) {
      whereConditions.push({
        categories: {
          in: [selectedCategory.id],
        },
      })
    }

    const productsResult = await payload.find({
      collection: 'products',
      where: {
        and: whereConditions,
      },
      sort: payloadSort,
      limit: 50,
      depth: 1,
    })

    products = productsResult.docs
  } catch {
    // Database connection catch
  }

  const pageTitle = selectedCategory ? selectedCategory.name : 'All Collections'

  return (
    <div className="bg-[#FAF8F5] min-h-screen pb-20">
      {/* Hero Header */}
      <div className="bg-white border-b border-stone-200/60 py-16 text-center px-4 sm:px-6 shadow-xs">
        <div className="max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.35em] font-semibold text-amber-800 block mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Curated Catalog
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal tracking-[0.15em] uppercase text-stone-900 mb-4">
            {pageTitle}
          </h1>
          <p className="text-xs text-stone-500 tracking-wider max-w-md mx-auto leading-relaxed">
            {selectedCategory?.description ||
              'Discover exquisite Pakistani unstitched fabrics, luxury pret, and hand-tailored formal wear.'}
          </p>
        </div>

        {/* Category Pills */}
        {mainCategories.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-10 max-w-4xl mx-auto px-4">
            <Link
              href="/shop"
              className="px-6 py-2.5 text-xs font-semibold uppercase tracking-widest bg-stone-900 text-white rounded-full shadow-xs"
            >
              All Products
            </Link>
            {mainCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/shop/${cat.slug}`}
                className="px-6 py-2.5 text-xs font-semibold uppercase tracking-widest bg-stone-100 text-stone-700 hover:bg-stone-900 hover:text-white rounded-full transition-all border border-stone-200/60"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-stone-200 rounded-xl shadow-xs">
            <p className="text-sm uppercase tracking-widest text-stone-500">
              No products found in the catalog yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product: any) => {
              const imageObj = product.images?.[0]?.image
              const imageUrl = typeof imageObj === 'object' ? imageObj?.url : imageObj
              const categoryName =
                (typeof product.primaryCategory === 'object' ? product.primaryCategory?.name : null) ||
                (typeof product.categories?.[0] === 'object' ? product.categories[0]?.name : null) ||
                'Luxury Fashion'

              return (
                <div
                  key={product.id}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-stone-200/70 shadow-xs hover:shadow-md transition-all duration-300"
                >
                  <Link
                    href={`/products/${product.slug}`}
                    className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100"
                  >
                    {imageUrl ? (
                      <GridTileImage
                        alt={product.title}
                        src={imageUrl}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 font-serif text-xs uppercase tracking-widest">
                        N's KI
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col flex-1 justify-between p-5">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-amber-800 font-semibold block mb-1">
                        {product.mainCategory?.name || 'Luxury Fashion'}
                        {categoryName}
                      </span>
                      <h2 className="font-serif text-base font-medium text-stone-900 uppercase tracking-wider group-hover:text-amber-900 transition-colors mb-3 leading-snug">
                        <Link href={`/products/${product.slug}`}>{product.title}</Link>
                      </h2>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                      <Price
                        amount={product.basePricePKR}
                        className="text-base font-serif font-bold text-stone-900"
                      />
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-[11px] uppercase tracking-widest font-semibold text-stone-900 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                      >
                        View <ArrowRight className="w-3 h-3 text-amber-800" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
