'use client'

import { Price } from '@/components/Price'
import { RichText } from '@/components/RichText'
import { RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { SizeSelector, type Variant } from './SizeSelector'
import { StickyMobileAddToCart } from './StickyMobileAddToCart'

type Props = {
  product: any
}

export function ProductDescription({ product }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | undefined>()
  const primaryCategory =
    typeof product.primaryCategory === 'object' ? product.primaryCategory : null
  const categoryName = primaryCategory?.name
  const categoriesList = Array.isArray(product.categories)
    ? product.categories.filter((cat: any) => typeof cat === 'object')
    : []
  const activePrice = selectedVariant?.pricePKR ?? product.basePricePKR

  return (
    <>
      <StickyMobileAddToCart product={product} selectedVariant={selectedVariant} />
      <div className="flex flex-col gap-6 glass-card p-6 sm:p-8 rounded-xl shadow-sm">
        {/* Category & Title */}
        <div>
          {categoryName && (
            <Link
              href={`/shop/${primaryCategory?.slug || ''}`}
              className="text-xs uppercase tracking-[0.3em] font-semibold text-secondary hover:underline block mb-2"
            >
              {categoryName}
            </Link>
          )}
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal tracking-[0.1em] uppercase text-foreground leading-tight">
            {product.title}
          </h1>
          {categoriesList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {categoriesList.map((cat: any) => (
                <Link
                  key={cat.id}
                  href={`/shop/${cat.slug}`}
                  className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded glass-pill text-foreground hover:bg-[#648698]/20 transition-colors font-medium"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
          {product.color && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mt-3">
              Color: <span className="text-foreground font-semibold">{product.color}</span>
            </p>
          )}
        </div>

        {/* PKR Pricing */}
        <div className="border-y border-border py-4 flex items-center justify-between bg-[#BDBAB9]/25 dark:bg-[#648698]/10 px-4 rounded-lg">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
              Price (PKR)
            </span>
            <span className="text-[11px] text-muted-foreground">
              {selectedVariant?.pricePKR ? 'Special variant price' : 'Inclusive of all taxes'}
            </span>
          </div>
          <Price amount={activePrice} className="text-2xl font-bold text-foreground font-serif" />
        </div>

        {/* Dynamic Size & Color Selector & Add To Cart */}
        <SizeSelector product={product} onVariantChange={setSelectedVariant} />

        {/* Product Description */}
        {product.description && (
          <div className="border-t border-border pt-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-secondary" />
              Product Details &amp; Fabric Care
            </h3>
            <div className="prose prose-sm max-w-none leading-relaxed p-4 rounded-lg border border-border bg-[#BDBAB9]/10 dark:bg-[#648698]/10 [&_*]:!text-foreground [&_strong]:!text-foreground [&_li]:!text-foreground [&_p]:!text-foreground [&_h1]:!text-foreground [&_h2]:!text-foreground [&_h3]:!text-foreground [&_h4]:!text-foreground">
              <RichText data={product.description} enableGutter={false} />
            </div>
          </div>
        )}

        {/* Luxury Service Badges */}
        <div className="border-t border-border pt-6 grid grid-cols-1 gap-3 text-xs text-foreground/80">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#BDBAB9]/20 dark:bg-[#03171E]/40 border border-border">
            <Truck className="w-4 h-4 text-secondary flex-shrink-0" />
            <span>
              <strong>Express Nationwide Delivery</strong> across Pakistan (2-4 business days)
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#BDBAB9]/20 dark:bg-[#03171E]/40 border border-border">
            <ShieldCheck className="w-4 h-4 text-secondary flex-shrink-0" />
            <span>
              <strong>Cash on Delivery (COD)</strong> & Online Payment Available
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#BDBAB9]/20 dark:bg-[#03171E]/40 border border-border">
            <RotateCcw className="w-4 h-4 text-secondary flex-shrink-0" />
            <span>
              <strong>7-Day Easy Exchange</strong> policy on all luxury unstitched & pret items
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
