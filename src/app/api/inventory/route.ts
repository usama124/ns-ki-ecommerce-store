import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })

    const productsResult = await payload.find({
      collection: 'products',
      limit: 300,
      depth: 2,
      overrideAccess: true,
    })

    const categoriesResult = await payload.find({
      collection: 'categories',
      limit: 100,
      overrideAccess: true,
    })

    const inventoryItems: any[] = []

    productsResult.docs.forEach((product: any) => {
      const primaryCat =
        typeof product.primaryCategory === 'object' ? product.primaryCategory : null
      const imageUrl =
        Array.isArray(product.images) && product.images[0]?.image
          ? typeof product.images[0].image === 'object'
            ? product.images[0].image.url
            : product.images[0].image
          : null

      if (Array.isArray(product.variants)) {
        product.variants.forEach((v: any, vIdx: number) => {
          const sizeName =
            typeof v.size === 'object' && v.size !== null
              ? v.size.name
              : String(v.size || 'OS')

          inventoryItems.push({
            productId: product.id,
            productTitle: product.title,
            productSlug: product.slug,
            productStatus: product.status,
            color: product.color || null,
            primaryCategory: primaryCat ? primaryCat.name : 'Unassigned',
            primaryCategorySlug: primaryCat ? primaryCat.slug : '',
            imageUrl,
            variantIndex: vIdx,
            sizeName,
            sku: v.sku || `LUJ-${product.id}-${vIdx}`,
            stock: typeof v.stock === 'number' ? v.stock : 0,
            allowBackorder: Boolean(v.allowBackorder),
            pricePKR: v.pricePKR ?? product.basePricePKR ?? 0,
          })
        })
      }
    })

    return NextResponse.json({
      success: true,
      totalProducts: productsResult.totalDocs,
      totalVariants: inventoryItems.length,
      categories: categoriesResult.docs.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
      inventory: inventoryItems,
    })
  } catch (error: any) {
    console.error('Error fetching inventory data:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch inventory data.' },
      { status: 500 },
    )
  }
}
