'use client'

import { Price } from '@/components/Price'
import { RichText } from '@/components/RichText'
import { RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { SizeSelector } from './SizeSelector'

type Props = {
  product: any
}

export function ProductDescription({ product }: Props) {
  const categoryName = typeof product.mainCategory === 'object' ? product.mainCategory?.name : null

  return (
    <div className="flex flex-col gap-6 bg-white p-6 sm:p-8 rounded-xl border border-stone-200/80 shadow-sm">
      {/* Category & Title */}
      <div>
        {categoryName && (
          <span className="text-xs uppercase tracking-[0.3em] font-semibold text-amber-800 block mb-2">
            {categoryName}
          </span>
        )}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal tracking-[0.1em] uppercase text-stone-900 leading-tight">
          {product.title}
        </h1>
      </div>

      {/* PKR Pricing */}
      <div className="border-y border-stone-200/60 py-4 flex items-center justify-between bg-stone-50/50 px-4 rounded-lg">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-semibold">
            Price (PKR)
          </span>
          <span className="text-[11px] text-stone-400">Inclusive of all taxes</span>
        </div>
        <Price
          amount={product.basePricePKR}
          className="text-2xl font-bold text-stone-900 font-serif"
        />
      </div>

      {/* Dynamic Size & Color Selector & Add To Cart */}
      <SizeSelector product={product} />

      {/* Product Description */}
      {product.description && (
        <div className="border-t border-stone-200/80 pt-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700" />
            Product Details & Fabric Care
          </h3>
          <div className="prose prose-stone prose-sm max-w-none text-stone-800 leading-relaxed font-normal bg-stone-50/60 p-4 rounded-lg border border-stone-200/60">
            <RichText data={product.description} enableGutter={false} />
          </div>
        </div>
      )}

      {/* Luxury Service Badges */}
      <div className="border-t border-stone-200/80 pt-6 grid grid-cols-1 gap-3 text-xs text-stone-700">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-stone-50/80 border border-stone-200/40">
          <Truck className="w-4 h-4 text-amber-800 flex-shrink-0" />
          <span>
            <strong>Express Nationwide Delivery</strong> across Pakistan (2-4 business days)
          </span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-stone-50/80 border border-stone-200/40">
          <ShieldCheck className="w-4 h-4 text-amber-800 flex-shrink-0" />
          <span>
            <strong>Cash on Delivery (COD)</strong> & Online Payment Available
          </span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-stone-50/80 border border-stone-200/40">
          <RotateCcw className="w-4 h-4 text-amber-800 flex-shrink-0" />
          <span>
            <strong>7-Day Easy Exchange</strong> policy on all luxury unstitched & pret items
          </span>
        </div>
      </div>
    </div>
  )
}
