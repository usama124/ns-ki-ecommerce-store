import { Media } from '@/components/Media'
import { Price } from '@/components/Price'
import type { Product } from '@/payload-types'
import Link from 'next/link'
import React from 'react'

type Props = {
  product: Partial<Product> & {
    salePriceDetails?: {
      isOnSale: boolean
      discountPercentage: number
      compareAtPrice: number | null
      effectivePrice: number
    }
  }
}

export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { basePricePKR, title, images, salePriceDetails } = product

  const isOnSale = salePriceDetails?.isOnSale ?? false
  const effectivePrice = salePriceDetails?.effectivePrice ?? basePricePKR ?? 0
  const compareAtPrice = salePriceDetails?.compareAtPrice ?? null
  const discount = salePriceDetails?.discountPercentage ?? 0

  const image =
    images?.[0]?.image && typeof images[0]?.image !== 'string' ? images[0]?.image : false

  return (
    <Link className="relative inline-block h-full w-full group" href={`/products/${product.slug}`}>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#03171E]">
        {isOnSale && (
          <div className="absolute top-3 left-3 z-10 bg-[#dc2626] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md animate-pulse">
            -{discount}% OFF
          </div>
        )}

        {image ? (
          <Media
            className="h-full w-full object-cover"
            imgClassName="h-full w-full object-cover transition duration-300 ease-in-out group-hover:scale-105"
            resource={image}
          />
        ) : (
          <div className="h-full w-full bg-white/5 flex items-center justify-center text-white/30 text-xs">
            No Image
          </div>
        )}
      </div>

      <div className="flex flex-col mt-3 gap-1">
        <h3 className="font-semibold text-sm text-[#03171E] dark:text-[#CBCCC7] group-hover:text-[#648698] transition-colors line-clamp-1">
          {title}
        </h3>

        <div className="flex items-center gap-2 text-xs">
          {isOnSale && typeof compareAtPrice === 'number' ? (
            <>
              <span className="font-bold text-[#dc2626]">
                <Price amount={effectivePrice} />
              </span>
              <span className="line-through text-gray-400 font-medium">
                <Price amount={compareAtPrice} />
              </span>
            </>
          ) : (
            typeof effectivePrice === 'number' && (
              <span className="font-semibold text-[#03171E] dark:text-[#CBCCC7]">
                <Price amount={effectivePrice} />
              </span>
            )
          )}
        </div>
      </div>
    </Link>
  )
}
