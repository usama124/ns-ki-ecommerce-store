import type { PayloadRequest } from 'payload'

type OrderItemInput = {
  product: string | { id: string; title?: string }
  variantSize: string
  variantColor?: string
  quantity: number
}

async function getSizeIdToNameMap(req: PayloadRequest): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!req?.payload?.find) return map

  try {
    const res = await req.payload.find({
      collection: 'sizes',
      limit: 300,
      req,
      overrideAccess: true,
      pagination: false,
    })
    if (res?.docs && Array.isArray(res.docs)) {
      res.docs.forEach((s: any) => {
        if (s?.id !== undefined && s?.id !== null && s?.name) {
          map.set(String(s.id).trim().toLowerCase(), String(s.name).trim().toLowerCase())
        }
      })
    }
  } catch {
    // Return empty map on error or unmocked payload
  }
  return map
}

/**
 * Validates stock availability for order items and deducts stock count.
 * Matches on size + color combination (color optional for backwards-compat).
 * Throws an Error if stock is insufficient and backordering is disabled.
 */
export async function validateAndDeductStock({
  items,
  req,
}: {
  items: OrderItemInput[]
  req: PayloadRequest
}) {
  const sizeMap = await getSizeIdToNameMap(req)

  for (const item of items) {
    const productId = typeof item.product === 'object' ? item.product.id : item.product
    if (!productId) continue

    const product = await req.payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      req,
      overrideAccess: true,
    })

    if (!product || !Array.isArray(product.variants)) continue

    let stockDeducted = false
    const updatedVariants = product.variants.map((variant: any) => {
      if (!variantMatches(variant, item.variantSize, item.variantColor, sizeMap)) return variant

      const currentStock = typeof variant.stock === 'number' ? variant.stock : 0
      const allowBackorder = Boolean(variant.allowBackorder)

      if (!allowBackorder && currentStock < item.quantity) {
        throw new Error(
          `Inventory constraint failed for "${product.title}" - Size: ${item.variantSize}. Order cancelled.`,
        )
      }

      stockDeducted = true
      return {
        ...variant,
        size:
          typeof variant.size === 'object' && variant.size !== null
            ? (variant.size.id ?? variant.size)
            : variant.size,
        stock: Math.max(0, currentStock - item.quantity),
      }
    })

    if (stockDeducted) {
      await req.payload.update({
        collection: 'products',
        id: productId,
        data: { variants: updatedVariants },
        req,
        overrideAccess: true,
      })
    }
  }
}

/**
 * Restores stock quantities for items in a cancelled order.
 */
export async function restoreOrderStock({
  items,
  req,
}: {
  items: OrderItemInput[]
  req: PayloadRequest
}) {
  const sizeMap = await getSizeIdToNameMap(req)

  for (const item of items) {
    const productId = typeof item.product === 'object' ? item.product.id : item.product
    if (!productId) continue

    const product = await req.payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      req,
      overrideAccess: true,
    })

    if (!product || !Array.isArray(product.variants)) continue

    let stockRestored = false
    const updatedVariants = product.variants.map((variant: any) => {
      if (!variantMatches(variant, item.variantSize, item.variantColor, sizeMap)) return variant

      const currentStock = typeof variant.stock === 'number' ? variant.stock : 0
      stockRestored = true
      return {
        ...variant,
        size:
          typeof variant.size === 'object' && variant.size !== null
            ? (variant.size.id ?? variant.size)
            : variant.size,
        stock: currentStock + item.quantity,
      }
    })

    if (stockRestored) {
      await req.payload.update({
        collection: 'products',
        id: productId,
        data: { variants: updatedVariants },
        req,
        overrideAccess: true,
      })
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function variantMatches(
  variant: any,
  size: any,
  _color?: string,
  sizeIdToNameMap?: Map<string, string>,
): boolean {
  if (!variant) return false

  const rawSize = variant.size
  const searchSize = String(size ?? '')
    .trim()
    .toLowerCase()
  if (!searchSize) return false

  let effectiveSizeName = ''
  let effectiveSizeId = ''

  if (rawSize && typeof rawSize === 'object') {
    effectiveSizeName = String(rawSize.name ?? '')
      .trim()
      .toLowerCase()
    effectiveSizeId = String(rawSize.id ?? '')
      .trim()
      .toLowerCase()
  } else if (rawSize !== undefined && rawSize !== null) {
    const strRaw = String(rawSize).trim().toLowerCase()
    effectiveSizeId = strRaw
    if (sizeIdToNameMap && sizeIdToNameMap.has(strRaw)) {
      effectiveSizeName = sizeIdToNameMap.get(strRaw)!
    } else {
      effectiveSizeName = strRaw
    }
  }

  return (
    (effectiveSizeName !== '' && effectiveSizeName === searchSize) ||
    (effectiveSizeId !== '' && effectiveSizeId === searchSize)
  )
}
