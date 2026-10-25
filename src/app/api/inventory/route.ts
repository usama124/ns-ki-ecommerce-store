import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { reportPage } from '@/utilities/orderReport'

export async function GET(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)

    const productsResult = await payload.find({
      collection: 'products',
      limit: 50,
      page: reportPage(new URL(req.url).searchParams),
      sort: 'id',
      depth: 2,
      user,
      overrideAccess,
    })

    const categoriesResult = await payload.find({
      collection: 'categories',
      pagination: false,
      depth: 0,
      select: { name: true, slug: true },
      user,
      overrideAccess,
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
            typeof v.size === 'object' && v.size !== null ? v.size.name : String(v.size || 'OS')

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
            variantId: String(v.id || ''),
            sizeName,
            sku: v.sku || `NKI-${product.id}-${vIdx}`,
            stock: typeof v.stock === 'number' ? v.stock : 0,
            allowBackorder: Boolean(v.allowBackorder),
            pricePKR: v.pricePKR ?? product.basePricePKR ?? 0,
          })
        })
      }
    })

    return privateJSON({
      success: true,
      totalProducts: productsResult.totalDocs,
      totalVariants: inventoryItems.length,
      variantsScope: 'current_product_page',
      pagination: { page: productsResult.page || 1, totalPages: productsResult.totalPages || 1, totalDocs: productsResult.totalDocs },
      categories: categoriesResult.docs.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
      inventory: inventoryItems,
    })
  } catch (error) {
    return requestError(error)
  }
}
