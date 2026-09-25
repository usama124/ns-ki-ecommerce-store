import React from 'react'
import { ProductCard } from './ProductCard'

export type ProductGridProps = {
  products: any[]
  className?: string
  emptyMessage?: string
}

export function ProductGrid({
  products = [],
  className = '',
  emptyMessage = 'No products found in this collection.',
}: ProductGridProps) {
  if (!products || products.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto overflow-x-hidden">
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 px-3 sm:px-6 ${className}`}
      >
        {products.map((product) => (
          <ProductCard key={product.id || product.slug} product={product} />
        ))}
      </div>
    </div>
  )
}
