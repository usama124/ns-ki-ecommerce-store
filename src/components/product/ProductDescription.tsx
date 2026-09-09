'use client'

import React from 'react'
import { Price } from '@/components/Price'
import { RichText } from '@/components/RichText'
import { SizeSelector } from './SizeSelector'

type Props = {
  product: any
}

export function ProductDescription({ product }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Category & Title */}
      <div>
        {product.mainCategory?.name && (
          <span className="text-xs uppercase tracking-[0.25em] font-semibold text-gray-500 block mb-2">
            {product.mainCategory.name}
          </span>
        )}
        <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-[0.15em] uppercase text-black">
          {product.title}
        </h1>
      </div>

      {/* PKR Pricing */}
      <div className="border-y border-gray-100 py-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-400">Price</span>
        <Price amount={product.basePricePKR} className="text-xl font-bold text-black" />
      </div>

      {/* Dynamic Size Selector & Add To Cart */}
      <SizeSelector product={product} />

      {/* Product Description */}
      {product.description && (
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-3">
            Product Details
          </h3>
          <div className="prose prose-sm max-w-none text-gray-600">
            <RichText data={product.description} />
          </div>
        </div>
      )}
    </div>
  )
}
