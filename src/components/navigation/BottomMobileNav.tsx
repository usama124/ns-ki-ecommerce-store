'use client'

import { useCart } from '@/providers/Cart'
import { Grid, Home, Search, ShoppingBag, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

type Props = {
  onOpenMobileMenu: () => void
  onOpenSearch: () => void
  onOpenCart: () => void
}

export function BottomMobileNav({ onOpenMobileMenu, onOpenSearch, onOpenCart }: Props) {
  const pathname = usePathname()
  const { itemCount } = useCart()

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#03171E]/95 backdrop-blur-xl border-t border-[#648698]/30 px-2 py-1 flex items-center justify-around shadow-2xl text-[#CBCCC7]">
      {/* Home */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-lg text-[10px] font-medium tracking-wider uppercase transition-colors ${
          pathname === '/' ? 'text-[#648698] font-bold' : 'text-[#CBCCC7] hover:text-white'
        }`}
      >
        <Home className="h-5 w-5 mb-0.5" />
        <span>Home</span>
      </Link>

      {/* Categories / Menu */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-lg text-[10px] font-medium tracking-wider uppercase text-[#CBCCC7] hover:text-white transition-colors"
        aria-label="Open categories menu"
      >
        <Grid className="h-5 w-5 mb-0.5 text-[#648698]" />
        <span>Catalog</span>
      </button>

      {/* Search */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-lg text-[10px] font-medium tracking-wider uppercase text-[#CBCCC7] hover:text-white transition-colors"
        aria-label="Search collection"
      >
        <Search className="h-5 w-5 mb-0.5 text-[#648698]" />
        <span>Search</span>
      </button>

      {/* Track Orders */}
      <Link
        href="/find-order"
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-lg text-[10px] font-medium tracking-wider uppercase transition-colors ${
          pathname.includes('order') ? 'text-[#648698] font-bold' : 'text-[#CBCCC7] hover:text-white'
        }`}
      >
        <UserCheck className="h-5 w-5 mb-0.5" />
        <span>Orders</span>
      </Link>

      {/* Cart */}
      <button
        type="button"
        onClick={onOpenCart}
        className="relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-lg text-[10px] font-medium tracking-wider uppercase text-[#CBCCC7] hover:text-white transition-colors"
        aria-label="View shopping bag"
      >
        <div className="relative">
          <ShoppingBag className="h-5 w-5 mb-0.5 text-[#648698]" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-[#648698] text-[#03171E] font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-[#03171E]">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </div>
        <span>Bag</span>
      </button>
    </div>
  )
}

