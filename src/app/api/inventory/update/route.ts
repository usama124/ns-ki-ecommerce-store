import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const payload = await getPayload({ config: configPromise })

    // Support single item or batch items update
    const updates: Array<{ productId: string; variantIndex: number; stock: number }> =
      Array.isArray(body.updates)
        ? body.updates
        : body.productId !== undefined
          ? [{ productId: body.productId, variantIndex: body.variantIndex ?? 0, stock: body.stock }]
          : []

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid inventory updates provided.' }, { status: 400 })
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
        overrideAccess: true,
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
        overrideAccess: true,
      })

      results.push({
        productId,
        variantIndex,
        newStock: updatedVariants[variantIndex].stock,
      })
    }

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Error updating inventory stock:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update inventory stock.' },
      { status: 500 },
    )
  }
}
