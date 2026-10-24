import { privateJSON, readJSON, RequestError, requestError, requireAdmin, validDocumentID } from '@/utilities/apiSecurity'
import { COMMERCE, commerceSession, commerceTransaction, mongoCommerce, type InternalRecord } from '@/utilities/commerceDatabase'
import { randomUUID } from 'node:crypto'

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
      const result = await commerceTransaction(payload, user, async transactionReq => {
      const { productId, variantIndex, stock } = update
      if (!productId || variantIndex === undefined || typeof stock !== 'number' || stock < 0) {
        throw new RequestError('Invalid stock update.')
      }

      const product = await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 0,
        user,
        overrideAccess,
        req: transactionReq,
      })

      if (!product || !Array.isArray(product.variants)) {
        throw new RequestError('Product unavailable.', 404)
      }

      const updatedVariants = [...product.variants]
      if (variantIndex < 0 || variantIndex >= updatedVariants.length) {
        throw new RequestError('Product variant unavailable.', 404)
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
        req: transactionReq,
        context: { commerceInventoryWrite: true },
      })
      await mongoCommerce(payload).db.collection<InternalRecord>(COMMERCE.movements).insertOne({
        _id: randomUUID(), kind: 'manual_adjustment', productId: String(product.id),
        variantId: String(product.variants[variantIndex].id), actorId: String(user.id),
        before: product.variants[variantIndex].stock, after: stock, createdAt: new Date(),
      }, { session: await commerceSession(transactionReq) })

      return {
        productId,
        variantIndex,
        newStock: updatedVariants[variantIndex].stock,
      }
      })
      results.push(result)
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
