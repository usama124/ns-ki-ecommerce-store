import { describe, expect, it } from 'vitest'

type Product = {
  basePricePKR: number
  variants?: Array<{
    size: string
    color?: string
    pricePKR?: number | null
  }>
}

function resolveProductPrice(
  product: Product,
  selectedVariantSize?: string,
  selectedVariantColor?: string,
): number {
  if (!product.variants || product.variants.length === 0) return product.basePricePKR

  const matchingVariant = product.variants.find((v) => {
    const sizeMatch = v.size === selectedVariantSize
    if (!selectedVariantColor) return sizeMatch
    return (
      sizeMatch &&
      (v.color || '').trim().toLowerCase() === selectedVariantColor.trim().toLowerCase()
    )
  })

  return matchingVariant?.pricePKR ?? product.basePricePKR
}

describe('Variant Pricing & Overrides', () => {
  it('returns base price when no variant price override is set', () => {
    const product: Product = {
      basePricePKR: 15000,
      variants: [{ size: 'M', color: 'Gold', pricePKR: null }],
    }

    expect(resolveProductPrice(product, 'M', 'Gold')).toBe(15000)
  })

  it('returns variant price override when pricePKR is specified on variant', () => {
    const product: Product = {
      basePricePKR: 15000,
      variants: [
        { size: 'M', color: 'Gold', pricePKR: 18500 },
        { size: 'L', color: 'Gold', pricePKR: 21000 },
      ],
    }

    expect(resolveProductPrice(product, 'M', 'Gold')).toBe(18500)
    expect(resolveProductPrice(product, 'L', 'Gold')).toBe(21000)
  })
})
