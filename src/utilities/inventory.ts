import type { PayloadRequest } from 'payload';

type OrderItemInput = {
  product: string | { id: string; title?: string }
  variantSize: string
  variantColor?: string
  quantity: number
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
      if (!variantMatches(variant, item.variantSize, item.variantColor)) return variant

      const currentStock = typeof variant.stock === 'number' ? variant.stock : 0
      const allowBackorder = Boolean(variant.allowBackorder)
      const label = buildVariantLabel(product.title, item.variantSize, item.variantColor)

      if (!allowBackorder && currentStock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${label}. Available: ${currentStock}, Requested: ${item.quantity}.`,
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
      if (!variantMatches(variant, item.variantSize, item.variantColor)) return variant

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

function variantMatches(variant: any, size: any, _color?: string): boolean {
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
    effectiveSizeName = String(rawSize).trim().toLowerCase()
    effectiveSizeId = String(rawSize).trim().toLowerCase()
  }

  return (
    (effectiveSizeName !== '' && effectiveSizeName === searchSize) ||
    (effectiveSizeId !== '' && effectiveSizeId === searchSize)
  )
}

function buildVariantLabel(title: string, size: string, _color?: string): string {
  return `"${title}" / Size: ${size}`
}
