'use client'

import React, { useState } from 'react'
import { AddToCart } from '@/components/Cart/AddToCart'

type Variant = {
  size: string
  stock: number
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

export function SizeSelector({ product }: Props) {
  const variants = product.variants || []
  
  // Default select first in-stock variant, or first variant
  const firstInStock = variants.find((v) => v.stock > 0)
  const [selectedSize, setSelectedSize] = useState<string>(
    firstInStock ? firstInStock.size : variants[0]?.size || ''
  )

  const selectedVariant = variants.find((v) => v.size === selectedSize)

  return (
    <div className="flex flex-col gap-6 my-6">
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

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {variants.map((variant) => {
              const outOfStock = variant.stock <= 0
              const isSelected = selectedSize === variant.size

              return (
                <button
                  key={variant.size}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => setSelectedSize(variant.size)}
                  className={`py-3 text-xs uppercase tracking-wider font-semibold border transition-all ${
                    isSelected
                      ? 'border-black bg-black text-white'
                      : outOfStock
                      ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50'
                      : 'border-gray-300 text-gray-800 hover:border-black'
                  }`}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>

          {/* Stock Count Indicator */}
          {selectedVariant && (
            <div className="mt-2 text-[11px] uppercase tracking-wider font-medium">
              {selectedVariant.stock <= 0 ? (
                <span className="text-red-600">Out of Stock</span>
              ) : selectedVariant.stock <= 3 ? (
                <span className="text-amber-600">Only {selectedVariant.stock} items left in stock</span>
              ) : (
                <span className="text-green-700">In Stock ({selectedVariant.stock} available)</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">No size options available for this product.</div>
      )}

      {/* Add To Bag Button */}
      <AddToCart
        product={product}
        selectedVariant={selectedVariant}
      />
    </div>
  )
}
