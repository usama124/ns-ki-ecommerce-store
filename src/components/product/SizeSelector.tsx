'use client'

import { AddToCart } from '@/components/Cart/AddToCart'
import { useEffect, useMemo, useState } from 'react'

// Size can be a relationship object { id, name } or a plain string (legacy)
type RelOrString =
  | { id?: number | string; name?: string }
  | string
  | null
  | undefined

export type Variant = {
  size: RelOrString
  stock: number
  allowBackorder?: boolean | null
  pricePKR?: number | null
  sku?: string | null
}

type Props = {
  product: {
    id: string
    slug: string
    title: string
    basePricePKR: number
    color?: string | null
    variants?: Variant[]
    images?: Array<{ image: { url?: string | null; alt?: string } }>
  }
  onVariantChange?: (variant: Variant | undefined) => void
}

/** Resolve effective size string from relationship object or legacy string */
export function getEffectiveSize(v: Variant): string {
  const s = v.size
  if (!s) return ''
  if (typeof s === 'object' && s !== null) return s.name?.trim() || ''
  return String(s).trim()
}

export function SizeSelector({ product, onVariantChange }: Props) {
  const rawVariants = product.variants || []

  const variants = useMemo(() => {
    return rawVariants.map((v) => ({
      ...v,
      effectiveSize: getEffectiveSize(v),
    }))
  }, [rawVariants])

  // Default selections: first in stock or first variant
  const firstAvailableVariant = variants.find((v) => v.stock > 0 || v.allowBackorder)

  const [selectedSize, setSelectedSize] = useState<string>(
    firstAvailableVariant?.effectiveSize || variants[0]?.effectiveSize || '',
  )

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.effectiveSize === selectedSize)
  }, [variants, selectedSize])

  useEffect(() => {
    if (onVariantChange) {
      onVariantChange(selectedVariant)
    }
  }, [selectedVariant, onVariantChange])

  return (
    <div className="flex flex-col gap-6 my-6">
      {/* Size Selector */}
      {variants.length > 0 ? (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs uppercase tracking-widest font-semibold text-gray-900">
              Select Size
            </label>
            {selectedVariant && (
              <span className="text-xs text-gray-500 font-mono">
                SKU: {selectedVariant.sku || 'N/A'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {variants.map((variant, idx) => {
              const outOfStock = variant.stock <= 0
              const backorderAllowed = Boolean(variant.allowBackorder)
              const isDisabled = outOfStock && !backorderAllowed
              const isSelected = selectedSize === variant.effectiveSize

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedSize(variant.effectiveSize)}
                  className={`px-4 py-2.5 min-w-[3.5rem] text-xs uppercase tracking-wider font-semibold border rounded-md whitespace-nowrap transition-all ${
                    isSelected
                      ? 'border-black bg-black text-white shadow-xs'
                      : isDisabled
                        ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50'
                        : outOfStock && backorderAllowed
                          ? 'border-amber-400 text-amber-900 bg-amber-50 hover:border-amber-600'
                          : 'border-gray-300 text-gray-800 hover:border-black'
                  }`}
                >
                  {variant.effectiveSize}
                </button>
              )
            })}
          </div>

          {/* Stock indicator */}
          {selectedVariant && (
            <div className="mt-3 text-[11px] uppercase tracking-wider font-medium">
              {selectedVariant.stock <= 0 && !selectedVariant.allowBackorder ? (
                <span className="text-red-600 font-bold">Out of Stock</span>
              ) : selectedVariant.stock <= 0 && selectedVariant.allowBackorder ? (
                <span className="text-amber-700 font-bold">
                  ✓ Available on Backorder (Pre-order)
                </span>
              ) : selectedVariant.stock <= 3 ? (
                <span className="text-amber-600">Only {selectedVariant.stock} left in stock</span>
              ) : (
                <span className="text-green-700">In Stock ({selectedVariant.stock} available)</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">
          No size options available for this product.
        </div>
      )}

      {/* Add To Bag */}
      <AddToCart
        product={product}
        selectedVariant={
          selectedVariant
            ? {
                ...selectedVariant,
                size: selectedVariant.effectiveSize,
              }
            : undefined
        }
      />
    </div>
  )
}
