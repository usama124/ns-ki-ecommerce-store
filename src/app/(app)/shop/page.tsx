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
    <div className="min-h-screen pb-20">
      {/* Hero Header */}
      <div className="relative glass-card rounded-xl p-5 sm:p-7 mb-6 text-center border border-[#648698]/30 shadow-lg overflow-hidden bg-gradient-to-br from-[#03171E]/90 via-[#0a2d3b]/80 to-[#648698]/20 backdrop-blur-xl">
        {/* Ambient Glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-[#648698]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-[#03171E]/40 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] font-semibold text-[#648698] dark:text-[#a0b6c3] glass-pill px-3 py-1 rounded-full mb-2">
            <Sparkles className="w-3 h-3 text-secondary" />
            Curated Catalog
          </span>

          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-[0.15em] uppercase text-foreground leading-tight my-1">
            {pageTitle}
          </h1>

          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-[#648698]/60 to-transparent mx-auto my-2" />

          <p className="text-[11px] text-muted-foreground tracking-wider max-w-md mx-auto leading-relaxed">
            {selectedCategory?.description ||
              'Discover exquisite Pakistani unstitched fabrics, luxury pret, and hand-tailored formal wear.'}
          </p>
        </div>

        {/* Category Pills */}
        {mainCategories.length > 0 && (
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 mt-5 max-w-3xl mx-auto px-2">
            <Link
              href="/shop"
              className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest glass-button-primary rounded-full shadow-md"
            >
              All Products
            </Link>
            {mainCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/shop/${cat.slug}`}
                className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest glass-pill text-foreground hover:bg-[#648698]/30 rounded-full transition-all"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {products.length === 0 ? (
          <div className="text-center py-20 glass-card border border-dashed border-border rounded-xl shadow-xs">
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              No products found in the catalog yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product: any) => {
              const imageObj = product.images?.[0]?.image
              const imageUrl = typeof imageObj === 'object' ? imageObj?.url : imageObj
              const categoryName =
                (typeof product.primaryCategory === 'object'
                  ? product.primaryCategory?.name
                  : null) ||
                (typeof product.categories?.[0] === 'object'
                  ? product.categories[0]?.name
                  : null) ||
                'Luxury Fashion'

              return (
                <div
                  key={product.id}
                  className="group flex flex-col glass-card rounded-xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300"
                >
                  <Link
                    href={`/products/${product.slug}`}
                    className="relative aspect-[3/4] w-full overflow-hidden bg-[#648698]/10"
                  >
                    {imageUrl ? (
                      <GridTileImage
                        alt={product.title}
                        src={imageUrl}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#648698]/10 text-muted-foreground font-serif text-xs uppercase tracking-widest">
                        N's KI
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col flex-1 justify-between p-5">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-semibold block mb-1">
                        {categoryName}
                      </span>
                      <h2 className="font-serif text-base font-medium text-foreground uppercase tracking-wider group-hover:text-[#BDBAB9] transition-colors mb-3 leading-snug">
                        <Link href={`/products/${product.slug}`}>{product.title}</Link>
                      </h2>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <Price
                        amount={product.basePricePKR}
                        className="text-base font-serif font-bold text-foreground"
                      />
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-[11px] uppercase tracking-widest font-semibold text-foreground flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                      >
                        View <ArrowRight className="w-3 h-3 text-secondary" />
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
