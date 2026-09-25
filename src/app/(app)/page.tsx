import { CategoryTabs } from '@/components/CategoryTabs'
import { HomepageHero } from '@/components/HomepageHero'
import { ProductGrid } from '@/components/products/ProductGrid'
import { ShoppableVideos } from '@/components/ShoppableVideos'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "LUJAIN | Pakistani Luxury Fashion",
  description:
    'Experience premier Pakistani unstitched and pret collections. Handcrafted luxury, pure fabrics, and timeless design.',
}

export default async function HomePage() {
  let homepageData: any = null
  let products: any[] = []
  let categories: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    const homepageResult = await payload.findGlobal({
      slug: 'homepage',
      depth: 2,
    })
    homepageData = homepageResult

    const categoriesResult = await payload.find({
      collection: 'categories',
      where: {
        type: {
          equals: 'main',
        },
      },
      limit: 12,
      depth: 1,
    })
    categories = categoriesResult.docs

    let featuredIds: any[] = []
    if (homepageData?.featuredProducts && Array.isArray(homepageData.featuredProducts)) {
      featuredIds = homepageData.featuredProducts
        .map((p: any) => (typeof p === 'object' ? p.id : p))
        .filter(Boolean)
    }

    if (featuredIds.length > 0) {
      const productsResult = await payload.find({
        collection: 'products',
        where: {
          and: [
            {
              id: {
                in: featuredIds,
              },
            },
            {
              status: {
                equals: 'published',
              },
            },
          ],
        },
        limit: 12,
        depth: 1,
      })
      products = productsResult.docs
    } else {
      const productsResult = await payload.find({
        collection: 'products',
        where: {
          status: {
            equals: 'published',
          },
        },
        sort: '-createdAt',
        limit: 8,
        depth: 1,
      })
      products = productsResult.docs
    }
  } catch {
    // Catch connection / compilation issues during setup
  }

  return (
    <div className="pb-24 sm:pb-12">
      {/* Dynamic Homepage Hero Slider */}
      <HomepageHero heroSlider={homepageData?.heroSlider || []} />

      {/* Featured Collection Section */}
      <section className="py-14 sm:py-20 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 border-b border-border/60 pb-4 px-1 sm:px-0">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-medium block mb-2">
              Curated Elegance
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-normal tracking-[0.15em] uppercase text-foreground">
              {homepageData?.featuredSectionTitle || 'Featured Collection'}
            </h2>
          </div>
          <Link
            href="/shop"
            className="mt-4 md:mt-0 text-xs font-semibold uppercase tracking-[0.2em] border-b-2 border-secondary pb-1 text-foreground hover:text-secondary transition-colors self-start md:self-auto"
          >
            View All Products &rarr;
          </Link>
        </div>

        <ProductGrid
          products={products}
          emptyMessage="No products published in the featured collection yet."
        />
      </section>

      {homepageData?.shoppableVideos && homepageData.shoppableVideos.length > 0 && (
        <ShoppableVideos reels={homepageData.shoppableVideos} />
      )}
    </div>
  )
}
