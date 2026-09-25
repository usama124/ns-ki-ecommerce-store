import { ProductGrid } from '@/components/products/ProductGrid'
import configPromise from '@payload-config'
import { Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    category: string
  }>
  searchParams: Promise<{
    category?: string
    sort?: string
    q?: string
  }>
}

export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  const { category: categorySlug } = await params
  const { category: queryCategory } = (await searchParams) || {}
  const activeCategoryIdentifier = queryCategory || categorySlug
  const isNumeric = /^\d+$/.test(activeCategoryIdentifier)

  try {
    const payload = await getPayload({ config: configPromise })

    const categoryResult = await payload.find({
      collection: 'categories',
      where: isNumeric
        ? { id: { equals: Number(activeCategoryIdentifier) } }
        : { slug: { equals: activeCategoryIdentifier } },
      limit: 1,
    })

    const cat = categoryResult.docs?.[0]
    if (!cat) return { title: "Collection | LUJAIN" }

    return {
      title: `${cat.name} Collection | LUJAIN Pakistani Luxury Fashion`,
      description: `Shop luxury ${cat.name} from LUJAIN Pakistani Luxury Fashion with express nationwide delivery.`,
    }
  } catch {
    return { title: "Collection | LUJAIN" }
  }
}

export default async function CategoryPage({ params, searchParams }: Args) {
  const { category: categorySlug } = await params
  const { category: queryCategory, sort: sortQuery } = (await searchParams) || {}
  const activeCategoryIdentifier = queryCategory || categorySlug
  const isNumeric = /^\d+$/.test(activeCategoryIdentifier)

  let targetCategory: any = null
  let products: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    const categoryResult = await payload.find({
      collection: 'categories',
      where: isNumeric
        ? { id: { equals: Number(activeCategoryIdentifier) } }
        : { slug: { equals: activeCategoryIdentifier } },
      limit: 1,
    })

    targetCategory = categoryResult.docs?.[0]

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
            {
              categories: {
                in: [targetCategory.id],
              },
            },
          ],
        },
        sort: payloadSort,
        limit: 50,
        depth: 1,
      })

      products = productsResult.docs
    }
  } catch {
    // Database connection catch
  }

  if (!targetCategory) return notFound()

  return (
    <div className="min-h-screen pb-24 sm:pb-12">
      {/* Hero Banner Header */}
      <div className="relative glass-card rounded-xl p-5 sm:p-7 mb-6 text-center border border-[#648698]/30 shadow-lg overflow-hidden bg-gradient-to-br from-[#03171E]/90 via-[#0a2d3b]/80 to-[#648698]/20 backdrop-blur-xl">
        {/* Ambient Glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-[#648698]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-[#03171E]/40 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] font-semibold text-[#648698] dark:text-[#a0b6c3] glass-pill px-3 py-1 rounded-full mb-2">
            <Sparkles className="w-3 h-3 text-secondary" />
            Curated Collection
          </span>

          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-[0.15em] uppercase text-foreground leading-tight my-1">
            {targetCategory.name}
          </h1>

          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-[#648698]/60 to-transparent mx-auto my-2" />

          {targetCategory.description && (
            <p className="text-[11px] text-muted-foreground tracking-wider max-w-md mx-auto leading-relaxed">
              {targetCategory.description}
            </p>
          )}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto pt-6">
        {products.length === 0 ? (
          <div className="text-center py-20 px-4 glass-card border border-dashed border-border rounded-xl shadow-xs max-w-2xl mx-auto">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-6">
              No products currently available in the "{targetCategory.name}" collection.
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
      </div>
    </div>
  )
}
