import { Gallery } from '@/components/product/Gallery'
import { ProductDescription } from '@/components/product/ProductDescription'
import { Button } from '@/components/ui/button'
import type { Media } from '@/payload-types'
import configPromise from '@payload-config'
import { ChevronLeft } from 'lucide-react'
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
    title: `${product.title} | N's KI`,
    description: product.title,
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

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          asChild
          variant="ghost"
          className="mb-6 hover:bg-gray-50 text-xs uppercase tracking-widest"
        >
          <Link href="/shop">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Collection
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <Suspense
              fallback={<div className="relative aspect-[3/4] w-full bg-gray-100 animate-pulse" />}
            >
              {Boolean(gallery?.length) && <Gallery gallery={gallery} />}
            </Suspense>

            {videoUrl && (
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-widest font-semibold text-gray-500 mb-3">
                  Product Reel Video
                </h3>
                <div className="relative max-w-sm aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-lg">
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

          <div className="lg:col-span-5 sticky top-28">
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
