import { GridTileImage } from '@/components/Grid/tile'
import { Price } from '@/components/Price'
import configPromise from '@payload-config'
import { ArrowRight, Sparkles } from 'lucide-react'
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
      title: `${cat.name} Collection | N's KI Pakistani Luxury Fashion`,
      description: `Shop luxury ${cat.name} from N's KI Pakistani Luxury Fashion with express nationwide delivery.`,
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
    <div className="bg-[#FAF8F5] min-h-screen pb-20">
      {/* Hero Banner Header */}
      <div className="bg-white border-b border-stone-200/60 py-16 text-center px-4 sm:px-6 shadow-xs">
        <div className="max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.35em] font-semibold text-amber-800 block mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Curated Collection
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal tracking-[0.15em] uppercase text-stone-900 mb-4">
            {targetCategory.name}
          </h1>
          {targetCategory.description && (
            <p className="text-xs text-stone-500 tracking-wider max-w-md mx-auto leading-relaxed">
              {targetCategory.description}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-stone-200 rounded-xl shadow-xs">
            <p className="text-sm uppercase tracking-widest text-stone-500 mb-6">
              No products currently available in the "{targetCategory.name}" collection.
            </p>
            <Link
              href="/shop"
              className="inline-block bg-stone-900 text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-black transition-colors rounded-xs shadow-xs"
            >
              Browse All Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product: any) => {
              const imageObj = product.images?.[0]?.image
              const imageUrl = typeof imageObj === 'object' ? imageObj?.url : imageObj

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
                        {targetCategory.name}
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
