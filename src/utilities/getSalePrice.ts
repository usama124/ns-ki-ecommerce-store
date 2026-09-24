export type SalePriceDetails = {
  isOnSale: boolean
  discountPercentage: number
  compareAtPrice: number | null
  effectivePrice: number
}

/**
 * Computes dynamic sale pricing for a product or product variant based on active SaleSettings.
 *
 * @param product Product object containing categories / primaryCategory / basePricePKR
 * @param saleSettings Active SaleSettings global data
 * @param variantPrice Optional variant price override in PKR
 */
export function getSalePriceDetails(
  product: any,
  saleSettings: any,
  variantPrice?: number | null,
): SalePriceDetails {
  const basePrice =
    typeof variantPrice === 'number' && variantPrice > 0
      ? variantPrice
      : (product?.basePricePKR ?? 0)

  if (!saleSettings || !saleSettings.isActive) {
    return {
      isOnSale: false,
      discountPercentage: 0,
      compareAtPrice: null,
      effectivePrice: basePrice,
    }
  }

  const now = Date.now()
  const start = saleSettings.startDate ? new Date(saleSettings.startDate).getTime() : 0
  const end = saleSettings.endDate ? new Date(saleSettings.endDate).getTime() : Infinity

  const isLive = now >= start && now <= end
  if (!isLive) {
    return {
      isOnSale: false,
      discountPercentage: 0,
      compareAtPrice: null,
      effectivePrice: basePrice,
    }
  }

  // Extract category IDs from product
  const productCatIds: string[] = []

  if (product?.primaryCategory) {
    const catId =
      typeof product.primaryCategory === 'object'
        ? product.primaryCategory?.id
        : product.primaryCategory
    if (catId) productCatIds.push(String(catId))
  }

  if (Array.isArray(product?.categories)) {
    for (const cat of product.categories) {
      const catId = typeof cat === 'object' ? cat?.id : cat
      if (catId) productCatIds.push(String(catId))
    }
  }

  // Extract targeted category IDs from saleSettings
  const targetedCatIds: string[] = []
  if (Array.isArray(saleSettings.targetedCategories)) {
    for (const tCat of saleSettings.targetedCategories) {
      const tId = typeof tCat === 'object' ? tCat?.id : tCat
      if (tId) targetedCatIds.push(String(tId))
    }
  }

  // Check direct or subcategory targeting match
  const isTargeted =
    targetedCatIds.length > 0 && productCatIds.some((id) => targetedCatIds.includes(id))

  if (isTargeted) {
    const discount = Math.min(99, Math.max(1, Number(saleSettings.discountPercentage) || 20))
    const effective = Math.round(basePrice * (1 - discount / 100))
    return {
      isOnSale: true,
      discountPercentage: discount,
      compareAtPrice: basePrice,
      effectivePrice: effective,
    }
  }

  return {
    isOnSale: false,
    discountPercentage: 0,
    compareAtPrice: null,
    effectivePrice: basePrice,
  }
}

