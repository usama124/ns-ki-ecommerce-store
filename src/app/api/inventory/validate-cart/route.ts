import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ valid: true, adjustments: [] })
    }

    const payload = await getPayload({ config: configPromise })
    const adjustments: Array<{
      productId: string
      variantSize: string
      variantColor?: string
      title: string
      availableStock: number
      requestedQuantity: number
      outOfStock: boolean
    }> = []

    for (const item of items) {
      const { productId, variantSize, variantColor, quantity } = item
      if (!productId) continue

      const product = await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 1,
        overrideAccess: true,
      }).catch(() => null)

      if (!product || !Array.isArray(product.variants)) continue

      const matchingVariant = product.variants.find((v: any) => {
        const rawSize = v.size
        const sizeName =
          typeof rawSize === 'object' && rawSize !== null
            ? String(rawSize.name || rawSize.id || '').trim().toLowerCase()
            : String(rawSize || '').trim().toLowerCase()

        return sizeName === String(variantSize || '').trim().toLowerCase()
      })

      if (!matchingVariant) continue

      const availableStock = typeof matchingVariant.stock === 'number' ? matchingVariant.stock : 0
      const allowBackorder = Boolean(matchingVariant.allowBackorder)

      if (!allowBackorder && availableStock < quantity) {
        adjustments.push({
          productId,
          variantSize,
          variantColor,
          title: product.title,
          availableStock: Math.max(0, availableStock),
          requestedQuantity: quantity,
          outOfStock: availableStock <= 0,
        })
      }
    }

    return NextResponse.json({
      valid: adjustments.length === 0,
      adjustments,
    })
  } catch (error: any) {
    console.error('Error validating cart stock:', error)
    return NextResponse.json({ valid: true, adjustments: [] })
  }
}

