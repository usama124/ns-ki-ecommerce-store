'use client'

import React, { useState, useMemo } from 'react'
import { AddToCart } from '@/components/Cart/AddToCart'

type Variant = {
  size: string
  color?: string | null
  colorHex?: string | null
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
    variants?: Variant[]
    images?: Array<{ image: { url?: string | null; alt?: string } }>
  }
}

/** Generate a soft pastel hex from a color name string */
function colorToFallbackHex(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 40%, 70%)`
}

export function SizeSelector({ product }: Props) {
  const variants = product.variants || []

  // ── Derive unique colors ───────────────────────────────────────────────────
  const colors = useMemo(() => {
    const seen = new Set<string>()
    const list: { name: string; hex: string | null }[] = []
    for (const v of variants) {
      const name = v.color?.trim() || ''
      if (name && !seen.has(name)) {
        seen.add(name)
        list.push({ name, hex: v.colorHex?.trim() || null })
      }
    }
    return list // empty = no colors configured, fall back to size-only mode
  }, [variants])

  const hasColors = colors.length > 0

  // ── Default selections ─────────────────────────────────────────────────────
  const firstAvailableVariant = variants.find(
    (v) => v.stock > 0 || v.allowBackorder
  )

  const [selectedColor, setSelectedColor] = useState<string>(
    hasColors
      ? (firstAvailableVariant?.color?.trim() || colors[0]?.name || '')
      : ''
  )
  const [selectedSize, setSelectedSize] = useState<string>(
    firstAvailableVariant?.size || variants[0]?.size || ''
  )

  // ── Filtered sizes for selected color ──────────────────────────────────────
  const sizesForColor = useMemo(() => {
    if (!hasColors) return variants
    return variants.filter(
      (v) => (v.color?.trim() || '') === selectedColor
    )
  }, [variants, selectedColor, hasColors])

  // ── When color changes, reset size to first available for that color ───────
  const handleColorSelect = (colorName: string) => {
    setSelectedColor(colorName)
    const firstForColor = variants.find(
      (v) =>
        (v.color?.trim() || '') === colorName &&
        (v.stock > 0 || v.allowBackorder)
    )
    setSelectedSize(
      firstForColor?.size ||
      variants.find((v) => (v.color?.trim() || '') === colorName)?.size ||
      ''
    )
  }

  // ── Find exact selected variant ────────────────────────────────────────────
  const selectedVariant = useMemo(() => {
    if (hasColors) {
      return variants.find(
        (v) =>
          v.size === selectedSize &&
          (v.color?.trim() || '') === selectedColor
      )
    }
    return variants.find((v) => v.size === selectedSize)
  }, [variants, selectedSize, selectedColor, hasColors])

  return (
    <div className="flex flex-col gap-6 my-6">
      {/* ── Color Selector ─────────────────────────────────────────────────── */}
      {hasColors && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs uppercase tracking-widest font-semibold text-gray-900">
              Color
            </label>
            <span className="text-xs text-gray-500 font-medium">
              {selectedColor || 'Select a colour'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {colors.map(({ name, hex }) => {
              const isSelected = selectedColor === name
              const bgColor = hex || colorToFallbackHex(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleColorSelect(name)}
                  title={name}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold border transition-all ${
                    isSelected
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 text-gray-700 hover:border-black'
                  }`}
                >
                  {/* Colour swatch dot */}
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-full border border-black/20 flex-shrink-0"
                    style={{ background: bgColor }}
                  />
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Size Selector ─────────────────────────────────────────────────── */}
      {variants.length > 0 ? (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs uppercase tracking-widest font-semibold text-gray-900">
              {hasColors ? 'Size' : 'Select Size'}
            </label>
            {selectedVariant && (
              <span className="text-xs text-gray-500 font-mono">
                SKU: {selectedVariant.sku || 'N/A'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {sizesForColor.map((variant) => {
              const outOfStock = variant.stock <= 0
              const backorderAllowed = Boolean(variant.allowBackorder)
              const isDisabled = outOfStock && !backorderAllowed
              const isSelected = selectedSize === variant.size

              return (
                <button
                  key={`${variant.size}-${variant.color}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedSize(variant.size)}
                  className={`py-3 text-xs uppercase tracking-wider font-semibold border transition-all ${
                    isSelected
                      ? 'border-black bg-black text-white'
                      : isDisabled
                      ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50'
                      : outOfStock && backorderAllowed
                      ? 'border-amber-400 text-amber-900 bg-amber-50 hover:border-amber-600'
                      : 'border-gray-300 text-gray-800 hover:border-black'
                  }`}
                >
                  {variant.size}
                </button>
              )
            })}
          </div>

          {/* Stock indicator */}
          {selectedVariant && (
            <div className="mt-2 text-[11px] uppercase tracking-wider font-medium">
              {selectedVariant.stock <= 0 && !selectedVariant.allowBackorder ? (
                <span className="text-red-600 font-bold">Out of Stock</span>
              ) : selectedVariant.stock <= 0 && selectedVariant.allowBackorder ? (
                <span className="text-amber-700 font-bold">✓ Available on Backorder (Pre-order)</span>
              ) : selectedVariant.stock <= 3 ? (
                <span className="text-amber-600">Only {selectedVariant.stock} left in stock</span>
              ) : (
                <span className="text-green-700">In Stock ({selectedVariant.stock} available)</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">No size options available for this product.</div>
      )}

      {/* ── Add To Bag ────────────────────────────────────────────────────── */}
      <AddToCart product={product} selectedVariant={selectedVariant} />
    </div>
  )
}
