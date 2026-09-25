'use client'

import { formatPKR } from '@/utilities/formatPKR'
import { Heart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useState } from 'react'

export type ProductCardProps = {
  product: {
    id?: string | number | null
    title?: string | null
    slug?: string | null
    basePricePKR?: number | null
    pricePKR?: number | null
    primaryCategory?: any
    categories?: any
    images?: Array<{
      image?: any
      id?: string | null
    }> | null
    media?: any
    salePriceDetails?: {
      isOnSale: boolean
      discountPercentage: number
      compareAtPrice: number | null
      effectivePrice: number
    }
  } & Record<string, any>
}

export function ProductCard({ product }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false)

  const { title = 'Luxury Product', slug, basePricePKR, pricePKR, images, salePriceDetails } = product

  // Resolve category name
  const categoryName =
    (typeof product.primaryCategory === 'object' && product.primaryCategory?.name) ||
    (Array.isArray(product.categories) &&
      typeof product.categories[0] === 'object' &&
      product.categories[0]?.name) ||
    'LUXURY PRET'

  // Resolve image URL
  const firstImg = images?.[0]?.image || product.media
  const imageUrl =
    typeof firstImg === 'object' && firstImg !== null
      ? firstImg.url || firstImg.sizes?.card?.url || firstImg.sizes?.thumbnail?.url
      : typeof firstImg === 'string'
      ? firstImg
      : null

  // Calculate pricing & sales
  const isOnSale = salePriceDetails?.isOnSale ?? false
  const effectivePrice =
    salePriceDetails?.effectivePrice ?? basePricePKR ?? pricePKR ?? 0
  const compareAtPrice =
    salePriceDetails?.compareAtPrice ??
    (isOnSale && basePricePKR && basePricePKR > effectivePrice ? basePricePKR : null)
  const discountPercent =
    salePriceDetails?.discountPercentage ??
    (compareAtPrice && effectivePrice < compareAtPrice
      ? Math.round(((compareAtPrice - effectivePrice) / compareAtPrice) * 100)
      : 0)

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsWishlisted(!isWishlisted)
  }

  return (
    <div className="group relative flex flex-col h-full rounded-xl md:rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-2.5 sm:p-3.5 md:p-4 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-sm hover:shadow-xl overflow-hidden">
      {/* Media Container: aspect-[3/4] on mobile & full desktop proportion */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg md:rounded-xl bg-[#0A1210]">
        <Link href={`/products/${slug || ''}`} className="block w-full h-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title || 'Product Image'}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
              className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-serif uppercase tracking-widest">
              LUJAIN
            </div>
          )}
        </Link>

        {/* Floating Discount Tag (Top-Left) */}
        {isOnSale && discountPercent > 0 && (
          <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10 text-[9px] sm:text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-200 border border-emerald-700/60 shadow-sm tracking-wide uppercase">
            FLAT {discountPercent}% OFF
          </div>
        )}

        {/* Floating Quick Wishlist Button (Top-Right) */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-2 right-2 md:top-3 md:right-3 z-10 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white/80 hover:text-red-500 transition-colors shadow-sm"
        >
          <Heart
            className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-transform active:scale-125 ${
              isWishlisted ? 'fill-red-500 text-red-500' : ''
            }`}
          />
        </button>
      </div>

      {/* Product Information */}
      <div className="flex flex-col flex-1 justify-between mt-2.5 sm:mt-3 md:mt-3.5">
        <div>
          {/* Category / Subtitle Badge */}
          <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-emerald-400/90 line-clamp-1 mb-1">
            {categoryName}
          </span>

          {/* Product Title (2-line clamp with min-height for aligned grid rows) */}
          <h3 className="text-xs sm:text-sm md:text-base font-semibold md:font-medium line-clamp-2 text-slate-100 min-h-[2rem] md:min-h-[2.5rem] leading-tight group-hover:text-emerald-300 transition-colors">
            <Link href={`/products/${slug || ''}`}>{title}</Link>
          </h3>
        </div>

        {/* Price Display */}
        <div className="mt-2 pt-2 md:mt-3 md:pt-2.5 border-t border-slate-800/60 flex items-baseline gap-1.5 md:gap-2 flex-wrap">
          <span className="text-xs sm:text-sm md:text-base font-bold text-white">
            {formatPKR(effectivePrice)}
          </span>
          {isOnSale && typeof compareAtPrice === 'number' && compareAtPrice > effectivePrice && (
            <span className="text-[10px] sm:text-xs md:text-sm line-through text-slate-400 font-normal">
              {formatPKR(compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
