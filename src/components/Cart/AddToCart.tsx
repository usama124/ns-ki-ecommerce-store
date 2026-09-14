'use client'

import { useCart } from '@/providers/Cart'
import { useState } from 'react'

// size/color can be a relationship object { id, name } or a plain string
type RelOrString =
  | { id?: number | string; name?: string; hexCode?: string }
  | string
  | null
  | undefined

type Variant = {
  size: RelOrString
  color?: RelOrString
  stock: number
  allowBackorder?: boolean | null
  pricePKR?: number | null
  sku?: string | null
}

// selectedVariant always has resolved string values after SizeSelector processes them
type ResolvedVariant = {
  size: string
  color?: string | null
  stock: number
  allowBackorder?: boolean | null
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
  selectedVariant?: ResolvedVariant
  selectedQuantity?: number
  className?: string
}

export function AddToCart({ product, selectedVariant, selectedQuantity = 1, className }: Props) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  const isOutOfStock = selectedVariant
    ? selectedVariant.stock <= 0 && !selectedVariant.allowBackorder
    : false
  const isBackorder = selectedVariant
    ? selectedVariant.stock <= 0 && Boolean(selectedVariant.allowBackorder)
    : false

  const price = selectedVariant?.pricePKR ?? product.basePricePKR
  const imageUrl = product.images?.[0]?.image?.url ?? undefined

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock) return
    addItem({
      productId: String(product.id),
      slug: product.slug,
      title: product.title,
      imageUrl,
      variantSize: selectedVariant.size,
      variantColor: selectedVariant.color ?? undefined,
      variantSku: selectedVariant.sku ?? undefined,
      price,
      quantity: selectedQuantity,
      stock: selectedVariant.stock,
      allowBackorder: Boolean(selectedVariant.allowBackorder),
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
            : isBackorder
              ? 'bg-amber-900 text-white hover:bg-amber-800'
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
            : isBackorder
              ? 'Add to Bag (Backorder)'
              : 'Add to Bag'}
    </button>
  )
}
