'use client'

import { useCart } from '@/providers/Cart'
import { ShoppingBag } from 'lucide-react'

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
      className="relative flex items-center gap-1.5 p-2 text-sm uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7] hover:text-[#648698] transition-colors"
      aria-label={`Open cart (${itemCount} items)`}
    >
      <ShoppingBag className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#648698] text-white text-[10px] font-bold shadow-xs">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  )
}
