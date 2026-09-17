'use client'

import { AddToCart } from '@/components/Cart/AddToCart'
import { useCart } from '@/providers/Cart'
import { useEffect, useMemo, useState } from 'react'

// Size can be a relationship object { id, name } or a plain string (legacy)
type RelOrString = { id?: number | string; name?: string } | string | null | undefined

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
  const { items: cartItems } = useCart()
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
  const [quantity, setQuantity] = useState<number>(1)

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.effectiveSize === selectedSize)
  }, [variants, selectedSize])

  // Reset selected quantity to 1 whenever size changes
  useEffect(() => {
    setQuantity(1)
  }, [selectedSize])

  const qtyInCart = useMemo(() => {
    const match = cartItems.find(
      (i) => i.productId === String(product.id) && i.variantSize === selectedSize,
    )
    return match ? match.quantity : 0
  }, [cartItems, product.id, selectedSize])

  useEffect(() => {
    if (onVariantChange) {
      onVariantChange(selectedVariant)
    }
  }, [selectedVariant, onVariantChange])

  const isOutOfStock = selectedVariant
    ? selectedVariant.stock <= 0 && !selectedVariant.allowBackorder
    : false

  return (
    <div className="flex flex-col gap-6 my-6">
      {/* Size Selector */}
      {variants.length > 0 ? (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs uppercase tracking-widest font-semibold text-foreground">
              Select Size
            </label>
            {selectedVariant && (
              <span className="text-xs text-muted-foreground font-mono">
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
                      ? 'border-[#03171e] bg-[#03171e] text-[#bdbab9] shadow-xs dark:bg-[#648698] dark:border-[#648698] dark:text-[#03171e]'
                      : isDisabled
                        ? 'border-border/40 text-muted-foreground/40 line-through cursor-not-allowed bg-[#BDBAB9]/10'
                        : outOfStock && backorderAllowed
                          ? 'border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:border-amber-600'
                          : 'border-border text-foreground hover:border-[#648698] bg-[#BDBAB9]/20 dark:bg-[#03171E]/40'
                  }`}
                >
                  {variant.effectiveSize}
                </button>
              )
            })}
          </div>

          {/* Dynamic Quantity Selector */}
          {selectedVariant && (
            <div className="flex items-center gap-3 mt-4">
              <label className="text-xs uppercase tracking-widest font-semibold text-foreground">
                Quantity
              </label>
              <div className="flex items-center border border-border rounded-md overflow-hidden bg-[#BDBAB9]/30 dark:bg-[#03171E]/60">
                <button
                  type="button"
                  disabled={quantity <= 1 || isOutOfStock}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1 text-sm font-bold text-foreground hover:bg-[#648698]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={
                    !selectedVariant.allowBackorder ? Math.max(1, selectedVariant.stock) : undefined
                  }
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1
                    const max = !selectedVariant.allowBackorder
                      ? Math.max(1, selectedVariant.stock)
                      : 9999
                    setQuantity(Math.max(1, Math.min(max, val)))
                  }}
                  disabled={isOutOfStock}
                  className="w-12 text-center text-xs font-bold border-none outline-none focus:ring-0 bg-transparent text-foreground"
                />
                <button
                  type="button"
                  disabled={
                    isOutOfStock ||
                    (!selectedVariant.allowBackorder && quantity >= selectedVariant.stock)
                  }
                  onClick={() => {
                    const max = !selectedVariant.allowBackorder
                      ? Math.max(1, selectedVariant.stock)
                      : 9999
                    setQuantity((q) => Math.min(max, q + 1))
                  }}
                  className="px-3 py-1 text-sm font-bold text-foreground hover:bg-[#648698]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Stock indicator */}
          {selectedVariant && (
            <div className="mt-3 text-[11px] uppercase tracking-wider font-medium flex flex-wrap items-center gap-2">
              {selectedVariant.stock <= 0 && !selectedVariant.allowBackorder ? (
                <span className="text-red-600 font-bold">Out of Stock</span>
              ) : selectedVariant.stock <= 0 && selectedVariant.allowBackorder ? (
                <span className="text-amber-700 font-bold">
                  ✓ Available on Backorder (Pre-order)
                </span>
              ) : !selectedVariant.allowBackorder && qtyInCart >= selectedVariant.stock ? (
                <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Maximum Available Stock ({selectedVariant.stock}) Already in Bag
                </span>
              ) : selectedVariant.stock <= 3 ? (
                <span className="text-amber-600">
                  Only {selectedVariant.stock} left in stock
                  {qtyInCart > 0 && ` (${qtyInCart} in your bag)`}
                </span>
              ) : (
                <span className="text-green-700">
                  In Stock ({selectedVariant.stock} available)
                  {qtyInCart > 0 && ` (${qtyInCart} in your bag)`}
                </span>
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
        selectedQuantity={quantity}
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
