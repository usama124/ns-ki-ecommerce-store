import { Gallery } from '@/components/product/Gallery'
import { ProductDescription } from '@/components/product/ProductDescription'
import { Button } from '@/components/ui/button'
import type { Media } from '@/payload-types'
import configPromise from '@payload-config'
import { ChevronLeft, Play } from 'lucide-react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Suspense } from 'react'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return { title: "N's KI Product" }

  const firstImage = product.images?.[0]?.image
  const imageUrl = typeof firstImage === 'object' ? firstImage?.url : undefined

  return {
    title: `${product.title} | N's KI Pakistani Luxury Fashion`,
    description: `Shop ${product.title} from N's KI luxury collection. Authentic Pakistani luxury fashion with express nationwide delivery.`,
    openGraph: imageUrl
      ? {
          images: [{ url: imageUrl }],
        }
      : null,
  }
}

export default async function ProductPage({ params }: Args) {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const gallery =
    product.images
      ?.filter((item: any) => typeof item.image === 'object')
      .map((item: any) => ({
        image: item.image as Media,
      })) || []

  const videoUrl = typeof product.productVideo === 'object' ? product.productVideo?.url : undefined

  const primaryCategory =
    typeof product.primaryCategory === 'object' ? product.primaryCategory : null
  const primaryCategoryName = primaryCategory?.name

  return (
    <div className="min-h-screen pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="glass-card rounded-xl border border-[#648698]/30 shadow-xs mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-foreground transition-colors">
              Shop
            </Link>
            {primaryCategoryName && (
              <>
                <span>/</span>
                <Link
                  href={`/shop/${primaryCategory?.slug || ''}`}
                  className="text-secondary font-semibold hover:underline transition-colors"
                >
                  {primaryCategoryName}
                </Link>
              </>
            )}
          </div>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-[#648698]/20"
          >
            <Link href="/shop">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Collection
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Gallery & Video */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <Suspense
              fallback={
                <div className="relative aspect-[3/4] w-full bg-[#648698]/20 animate-pulse rounded-xl" />
              }
            >
              {Boolean(gallery?.length) && <Gallery gallery={gallery} />}
            </Suspense>

            {videoUrl && (
              <div className="glass-card p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="w-4 h-4 text-secondary" />
                  <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-foreground">
                    Product Reel & Fabric Movement
                  </h3>
                </div>
                <div className="relative max-w-xs sm:max-w-sm aspect-[9/16] bg-[#03171E] rounded-lg overflow-hidden shadow-lg mx-auto border border-border">
                  <video
                    src={videoUrl}
                    controls
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Product Description & Size Selector */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <ProductDescription product={product} />
          </div>
        </div>
      </div>
    </div>
  )
}

const queryProductBySlug = async ({ slug }: { slug: string }) => {
  try {
    const { isEnabled: draft } = await draftMode()
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'products',
      depth: 2,
      draft,
      limit: 1,
      overrideAccess: draft,
      pagination: false,
      where: {
        and: [
          {
            slug: {
              equals: slug,
            },
          },
          ...(draft ? [] : [{ status: { equals: 'published' } }]),
        ],
      },
    })

    return result.docs?.[0] || null
  } catch {
    return null
  }
}
