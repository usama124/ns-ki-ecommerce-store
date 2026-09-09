import { GridTileImage } from '@/components/Grid/tile'
import { Price } from '@/components/Price'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "All Products | N's KI Pakistani Luxury Fashion",
  description: 'Browse all luxury Pakistani unstitched and pret collections.',
}

export default async function ShopPage() {
  let products: any[] = []
  let mainCategories: any[] = []

  try {
    const payload = await getPayload({ config: configPromise })

    const productsResult = await payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: 50,
      depth: 1,
    })

    const categoriesResult = await payload.find({
      collection: 'categories',
      where: { type: { equals: 'main' } },
      limit: 20,
    })

    products = productsResult.docs
    mainCategories = categoriesResult.docs
  } catch {
    // Database connection catch
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.3em] font-medium text-gray-400 block mb-2">
            Catalog
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-[0.15em] uppercase text-black">
            All Collections
          </h1>
        </div>

        {mainCategories.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            <Link
              href="/shop"
              className="px-5 py-2 text-xs font-semibold uppercase tracking-widest bg-black text-white rounded-full"
            >
              All
            </Link>
            {mainCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/shop/${cat.slug}`}
                className="px-5 py-2 text-xs font-medium uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-black hover:text-white rounded-full transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-sm">
            <p className="text-sm uppercase tracking-widest text-gray-500">
              No products found in the catalog.
            </p>
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
                        {product.mainCategory?.name || 'Collection'}
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
