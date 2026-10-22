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

    if (items.length > 100 || items.some((item) => !item?.productId || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ valid: false, adjustments: [], error: 'Invalid cart items.' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const productIds = [...new Set(items.map((item) => item.productId))]
    // One product query for the cart, rather than one network round-trip per line.
    const result = await payload.find({
      collection: 'products',
      where: { and: [{ id: { in: productIds } }, { status: { equals: 'published' } }] },
      depth: 1,
      pagination: false,
      overrideAccess: false,
      select: { title: true, variants: true },
    })
    const products = new Map(result.docs.map((product) => [String(product.id), product]))
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

      const product = products.get(String(productId))

      const matchingVariant = product?.variants?.find((v: any) => {
        const rawSize = v.size
        const sizeName =
          typeof rawSize === 'object' && rawSize !== null
            ? String(rawSize.name || rawSize.id || '').trim().toLowerCase()
            : String(rawSize || '').trim().toLowerCase()

        return sizeName === String(variantSize || '').trim().toLowerCase()
      })

      const availableStock = typeof matchingVariant?.stock === 'number' ? matchingVariant.stock : 0
      const allowBackorder = Boolean(matchingVariant?.allowBackorder)

      if (!allowBackorder && availableStock < quantity) {
        adjustments.push({
          productId,
          variantSize,
          variantColor,
          title: product?.title || 'Unavailable product',
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
    return NextResponse.json({ valid: false, adjustments: [], error: 'Stock validation is temporarily unavailable. Please retry.' }, { status: 503 })
  }
}

