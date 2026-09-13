'use client'

import { Price } from '@/components/Price'
import { RichText } from '@/components/RichText'
import { RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { SizeSelector, type Variant } from './SizeSelector'

type Props = {
  product: any
}

export function ProductDescription({ product }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | undefined>()
  const primaryCategory = typeof product.primaryCategory === 'object' ? product.primaryCategory : null
  const categoryName = primaryCategory?.name
  const categoriesList = Array.isArray(product.categories)
    ? product.categories.filter((cat: any) => typeof cat === 'object')
    : []
  const activePrice = selectedVariant?.pricePKR ?? product.basePricePKR

  return (
    <div className="flex flex-col gap-6 bg-white p-6 sm:p-8 rounded-xl border border-stone-200/80 shadow-sm">
      {/* Category & Title */}
      <div>
        {categoryName && (
          <Link
            href={`/shop/${primaryCategory?.slug || ''}`}
            className="text-xs uppercase tracking-[0.3em] font-semibold text-amber-800 hover:underline block mb-2"
          >
            {categoryName}
          </Link>
        )}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal tracking-[0.1em] uppercase text-stone-900 leading-tight">
          {product.title}
        </h1>
        {categoriesList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {categoriesList.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/shop/${cat.slug}`}
                className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/60 hover:bg-amber-100 transition-colors font-medium"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
        {product.color && (
          <p className="text-xs uppercase tracking-widest text-stone-500 font-medium mt-3">
            Color: <span className="text-stone-900 font-semibold">{product.color}</span>
          </p>
        )}
      </div>

      {/* PKR Pricing */}
      <div className="border-y border-stone-200/60 py-4 flex items-center justify-between bg-stone-50/50 px-4 rounded-lg">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-semibold">
            Price (PKR)
          </span>
          <span className="text-[11px] text-stone-400">
            {selectedVariant?.pricePKR ? 'Special variant price' : 'Inclusive of all taxes'}
          </span>
        </div>
        <Price amount={activePrice} className="text-2xl font-bold text-stone-900 font-serif" />
      </div>

      {/* Dynamic Size & Color Selector & Add To Cart */}
      <SizeSelector product={product} onVariantChange={setSelectedVariant} />

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
