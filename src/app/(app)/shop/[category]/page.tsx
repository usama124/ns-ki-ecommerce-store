import { GridTileImage } from '@/components/Grid/tile'
import { Price } from '@/components/Price'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    category: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category: categorySlug } = await params
  try {
    const payload = await getPayload({ config: configPromise })

    const categoryResult = await payload.find({
      collection: 'categories',
      where: { slug: { equals: categorySlug } },
      limit: 1,
    })

    const cat = categoryResult.docs?.[0]
    if (!cat) return { title: "Collection | N's KI" }

    return {
      title: `${cat.name} Collection | N's KI`,
      description: `Shop luxury ${cat.name} from N's KI Pakistani Luxury Fashion.`,
    }
  } catch {
    return { title: "Collection | N's KI" }
  }
}

export default async function CategoryPage({ params }: Args) {
  const { category: categorySlug } = await params
  let targetCategory: any = null
  let products: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    const categoryResult = await payload.find({
      collection: 'categories',
      where: { slug: { equals: categorySlug } },
      limit: 1,
    })

    targetCategory = categoryResult.docs?.[0]

    if (targetCategory) {
      const productsResult = await payload.find({
        collection: 'products',
        where: {
          and: [
            { status: { equals: 'published' } },
            {
              or: [
                { mainCategory: { equals: targetCategory.id } },
                { subCategories: { equals: targetCategory.id } },
              ],
            },
          ],
        },
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
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.3em] font-medium text-gray-400 block mb-2">
            Collection
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-[0.15em] uppercase text-black">
            {targetCategory.name}
          </h1>
          {targetCategory.description && (
            <p className="text-xs text-gray-500 mt-3 tracking-wider max-w-md mx-auto">
              {targetCategory.description}
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-sm">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-4">
              No products found in the "{targetCategory.name}" collection.
            </p>
            <Link
              href="/shop"
              className="inline-block border border-black px-6 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
            >
              Browse All Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
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
                        LUJAIN
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col flex-1 justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium block mb-1">
                        {targetCategory.name}
                      </span>
                      <h2 className="font-serif text-sm font-medium text-black uppercase tracking-wider group-hover:text-gray-600 transition-colors mb-2">
                        <Link href={`/products/${product.slug}`}>{product.title}</Link>
                      </h2>
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
      </div>
    </div>
  )
}
