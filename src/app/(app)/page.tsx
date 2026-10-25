import { HomepageHero } from '@/components/HomepageHero'
import { ProductGrid } from '@/components/products/ProductGrid'
import { ShoppableVideos } from '@/components/ShoppableVideos'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import { productCardSelect } from '@/utilities/productCardSelect'
import { isVisibleShoppableReel } from '@/utilities/shoppableVideoVisibility'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Siblings by N’s KI | Discover the Art of Unstitched',
  description:
    'Experience premier Pakistani unstitched and pret collections. Handcrafted luxury, pure fabrics, and timeless design.',
}

export default async function HomePage() {
  let homepageData: any = null
  let products: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    const [homepageResult, productsResult] = await Promise.all([
      payload.findGlobal({
        slug: 'homepage',
        depth: 2,
        populate: { products: { ...productCardSelect, variants: true, color: true, status: true, showInShopByVideo: true, productVideo: true } },
      }),
      payload.find({
        collection: 'products',
        where: {
          and: [{ status: { equals: 'published' } }, { isFeatured: { equals: true } }],
        },
        sort: '-createdAt',
        limit: 8,
        depth: 1,
        select: productCardSelect,
      }),
    ])
    homepageData = homepageResult
    products = productsResult.docs
  } catch (error) {
    console.error('Homepage data loading failed', error)
    throw error
  }

  return (
    <div className="pb-8 sm:pb-10">
      {/* Dynamic Homepage Hero Slider */}
      <HomepageHero heroSlider={homepageData?.heroSlider || []} />

      {/* Featured Collection Section */}
      <section className="pt-8 sm:pt-10 pb-4 sm:pb-6 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-5 sm:mb-6 border-b border-border/60 pb-4 px-1 sm:px-0">
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
          listId="homepage_featured"
          products={products}
          emptyMessage="No products published in the featured collection yet."
        />
      </section>

      {homepageData?.shoppableVideos && homepageData.shoppableVideos.length > 0 && (
        <ShoppableVideos reels={homepageData.shoppableVideos.filter(isVisibleShoppableReel)} />
      )}
    </div>
  )
}
