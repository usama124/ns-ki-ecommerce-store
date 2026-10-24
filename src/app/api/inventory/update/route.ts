import { privateJSON, readJSON, RequestError, requestError, requireAdmin, validDocumentID } from '@/utilities/apiSecurity'

export async function POST(req: Request) {
  try {
    const { payload, user, overrideAccess } = await requireAdmin(req)
    const body = await readJSON(req)

    // Support single item or batch items update
    const updates = (
      Array.isArray(body.updates)
        ? body.updates
        : body.productId !== undefined
          ? [{ productId: body.productId, variantIndex: body.variantIndex ?? 0, stock: body.stock }]
          : []) as Array<{ productId: string | number; variantIndex: number; stock: number }>

    if (updates.length === 0 || updates.length > 100 || updates.some(update => !update || !validDocumentID(update.productId) || !Number.isSafeInteger(update.variantIndex) || update.variantIndex < 0 || !Number.isSafeInteger(update.stock) || update.stock < 0 || update.stock > 1_000_000)) {
      throw new RequestError('Provide 1–100 valid inventory updates with integer stock and variant indexes.')
    }

    const results = []

    for (const update of updates) {
      const { productId, variantIndex, stock } = update
      if (!productId || variantIndex === undefined || typeof stock !== 'number' || stock < 0) {
        continue
      }

      const product = await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 0,
        user,
        overrideAccess,
      })

      if (!product || !Array.isArray(product.variants)) {
        continue
      }

      const updatedVariants = [...product.variants]
      if (variantIndex < 0 || variantIndex >= updatedVariants.length) {
        continue
      }

      updatedVariants[variantIndex] = {
        ...updatedVariants[variantIndex],
        stock: Math.max(0, Math.floor(stock)),
      }

      await payload.update({
        collection: 'products',
        id: productId,
        data: {
          variants: updatedVariants.map((v: any) => ({
            ...v,
            size: typeof v.size === 'object' && v.size !== null ? (v.size.id ?? v.size) : v.size,
          })),
        },
        user,
        overrideAccess,
      })

      results.push({
        productId,
        variantIndex,
        newStock: updatedVariants[variantIndex].stock,
      })
    }

    return privateJSON({
      success: true,
      updatedCount: results.length,
      results,
    })
  } catch (error) {
    return requestError(error)
  }
}
