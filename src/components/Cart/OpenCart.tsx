'use client'

import React from 'react'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/providers/Cart'

export function OpenCartButton() {
  return (
    <button className="relative flex items-center gap-1 p-2 text-sm uppercase tracking-widest">
      <ShoppingBag className="h-5 w-5" />
    </button>
  )
}

export function OpenCart({ onClick }: { onClick?: () => void }) {
  const { itemCount } = useCart()

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1 p-2 text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
      aria-label={`Open cart (${itemCount} items)`}
    >
      <ShoppingBag className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-white text-[10px] font-medium">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  )
}
