'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'
import Link from 'next/link'
import { X } from 'lucide-react'

type Variant = {
  size: string
  stock: number
  pricePKR?: number | null
  sku?: string | null
}

type Product = {
  id: string
  slug: string
  title: string
  basePricePKR: number
  variants?: Variant[]
  images?: Array<{ image: { url?: string | null; alt?: string } }>
}

type Props = {
  product: Product
  selectedVariant?: Variant
  className?: string
}

export function AddToCart({ product, selectedVariant, className }: Props) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  const isOutOfStock = selectedVariant ? selectedVariant.stock <= 0 : false
  const price = selectedVariant?.pricePKR ?? product.basePricePKR
  const imageUrl = product.images?.[0]?.image?.url ?? undefined

  const handleAddToCart = () => {
    if (!selectedVariant) return
    addItem({
      productId: String(product.id),
      slug: product.slug,
      title: product.title,
      imageUrl,
      variantSize: selectedVariant.size,
      variantSku: selectedVariant.sku ?? undefined,
      price,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <button
      className={`w-full py-4 px-8 text-sm font-medium tracking-widest uppercase transition-colors ${
        isOutOfStock || !selectedVariant
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : added
            ? 'bg-green-800 text-white'
            : 'bg-black text-white hover:bg-gray-800'
      } ${className ?? ''}`}
      disabled={isOutOfStock || !selectedVariant}
      onClick={handleAddToCart}
    >
      {!selectedVariant
        ? 'Select a Size'
        : isOutOfStock
          ? 'Out of Stock'
          : added
            ? '✓ Added to Bag'
            : 'Add to Bag'}
    </button>
  )
}
