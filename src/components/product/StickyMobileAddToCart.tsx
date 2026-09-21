'use client'

import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'
import { ShoppingBag } from 'lucide-react'
import React, { useState } from 'react'

type Variant = {
  size: any
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
    images?: Array<{ image: { url?: string | null } }>
  }
  selectedVariant?: Variant
  onSelectSize?: (size: string) => void
}

function resolveSizeName(size: any): string {
  if (!size) return ''
  if (typeof size === 'object') return size.name || ''
  return String(size)
}

export function StickyMobileAddToCart({ product, selectedVariant, onSelectSize }: Props) {
  const { addItem } = useCart()
  const variants = product.variants || []
  const activePrice = selectedVariant?.pricePKR ?? product.basePricePKR
  const currentSize = selectedVariant ? resolveSizeName(selectedVariant.size) : 'Unstitched'

  const handleAddToCart = () => {
    const imageUrl =
      typeof product.images?.[0]?.image === 'object'
        ? product.images[0].image.url || undefined
        : undefined

    addItem({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      imageUrl,
      variantSize: currentSize || 'Unstitched',
      variantSku: selectedVariant?.sku || undefined,
      price: activePrice,
    })
  }

  const isOutOfStock = selectedVariant
    ? selectedVariant.stock <= 0 && !selectedVariant.allowBackorder
    : false

  return (
    <div className="lg:hidden fixed bottom-12 left-0 right-0 z-30 p-3 bg-white/95 dark:bg-[#03171E]/95 backdrop-blur-xl border-t border-[#648698]/30 shadow-2xl flex items-center justify-between gap-3 text-[#03171E] dark:text-[#CBCCC7]">
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-[#648698] font-bold truncate max-w-[140px]">
          {product.title}
        </span>
        <span className="text-sm font-serif font-bold text-foreground">
          {formatPKR(activePrice)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {variants.length > 0 && onSelectSize && (
          <select
            value={currentSize}
            onChange={(e) => onSelectSize(e.target.value)}
            className="px-2 py-2 text-xs font-semibold bg-[#BDBAB9]/25 dark:bg-[#07242e] border border-[#648698]/40 rounded-lg text-foreground min-h-[44px] focus:outline-none"
          >
            {variants.map((v, i) => {
              const name = resolveSizeName(v.size)
              const disabled = v.stock <= 0 && !v.allowBackorder
              return (
                <option key={i} value={name} disabled={disabled}>
                  {name} {disabled ? '(Sold Out)' : ''}
                </option>
              )
            })}
          </select>
        )}

        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleAddToCart}
          className="glass-button-primary px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 min-h-[44px] disabled:opacity-40 whitespace-nowrap shadow-sm"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Add To Bag</span>
        </button>
      </div>
    </div>
  )
}
