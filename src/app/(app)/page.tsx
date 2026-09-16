import { GridTileImage } from '@/components/Grid/tile'
import { HomepageHero } from '@/components/HomepageHero'
import { Price } from '@/components/Price'
import { ShoppableVideos } from '@/components/ShoppableVideos'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "N's KI | Pakistani Luxury Fashion & E-Commerce",
  description:
    "Discover luxury Pakistani unstitched, pret, and formal collections dynamically curated by N's KI.",
}

export default async function Homepage() {
  let homepageData: any = null
  let products: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    try {
      homepageData = await payload.findGlobal({
        slug: 'homepage',
        depth: 2,
      })
    } catch {
      // global missing fallback
    }

    const featuredProductsResult = await payload.find({
      collection: 'products',
      where: {
        and: [{ status: { equals: 'published' } }, { isFeatured: { equals: true } }],
      },
      limit: 8,
      depth: 1,
    })

    products = featuredProductsResult.docs
    if (products.length === 0) {
      const allPublished = await payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } },
        limit: 8,
        depth: 1,
      })
      products = allPublished.docs
    }

    try {
      const videoProductsResult = await payload.find({
        collection: 'products',
        where: {
          and: [{ status: { equals: 'published' } }, { productVideo: { exists: true } }],
        },
        limit: 10,
        depth: 2,
      })

      if (videoProductsResult?.docs?.length > 0) {
        const dynamicReels = videoProductsResult.docs.map((p: any) => ({
          title: p.title,
          video: p.productVideo,
          poster: p.images?.[0]?.image,
          linkedProduct: p,
        }))

        const existingLinkedIds = new Set(
          (homepageData?.shoppableVideos || [])
            .map((r: any) =>
              typeof r.linkedProduct === 'object' && r.linkedProduct !== null
                ? r.linkedProduct.id
                : r.linkedProduct,
            )
            .filter(Boolean),
        )

        const newDynamicReels = dynamicReels.filter(
          (r: any) => !existingLinkedIds.has(r.linkedProduct?.id || r.linkedProduct),
        )

        homepageData = {
          ...homepageData,
          shoppableVideos: [...(homepageData?.shoppableVideos || []), ...newDynamicReels],
        }
      }
    } catch {
      // Optional fallback catch
    }
  } catch {
    // Database connection catch
  }

  return (
    <div className="min-h-screen bg-white">
      <HomepageHero heroSlider={homepageData?.heroSlider || []} />

      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-gray-100 pb-4">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 font-medium block mb-2">
              Curated Elegance
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-[0.15em] uppercase text-black">
              {homepageData?.featuredSectionTitle || 'Featured Collection'}
            </h2>
          </div>
          <Link
            href="/shop"
            className="mt-4 md:mt-0 text-xs font-semibold uppercase tracking-[0.2em] border-b-2 border-black pb-1 hover:text-gray-600 hover:border-gray-600 transition-colors self-start md:self-auto"
          >
            View All Products &rarr;
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 bg-neutral-50 rounded-xs border border-dashed border-gray-200">
            <h3 className="font-serif text-xl text-gray-800 uppercase tracking-widest mb-2">
              No Products Published Yet
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
              Log into Payload Admin (/admin) to add luxury products to your collection.
            </p>
            <Link
              href="/admin"
              className="inline-block bg-black text-white text-xs font-semibold uppercase tracking-widest px-6 py-3 hover:bg-gray-800"
            >
              Open Payload Admin
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {products.map((product: any) => {
              const imageObj = product.images?.[0]?.image
              const imageUrl = typeof imageObj === 'object' ? imageObj?.url : imageObj

              return (
                <div key={product.id} className="group flex flex-col">
                  <Link
                    href={`/products/${product.slug}`}
                    className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 mb-4"
                  >
                    {imageUrl ? (
                      <GridTileImage
                        alt={product.title}
                        src={imageUrl}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs uppercase tracking-widest">
                        N's KI
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col flex-1 justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium block mb-1">
                        {product.primaryCategory?.name ||
                          product.categories?.[0]?.name ||
                          'Luxury Pret'}
                      </span>
                      <h3 className="font-serif text-sm font-medium text-black uppercase tracking-wider group-hover:text-gray-600 transition-colors mb-2">
                        <Link href={`/products/${product.slug}`}>{product.title}</Link>
                      </h3>
                    </div>
                    <Price
                      amount={product.basePricePKR}
                      className="text-sm font-semibold text-black"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {homepageData?.shoppableVideos && homepageData.shoppableVideos.length > 0 && (
        <ShoppableVideos reels={homepageData.shoppableVideos} />
      )}
    </div>
  )
}
