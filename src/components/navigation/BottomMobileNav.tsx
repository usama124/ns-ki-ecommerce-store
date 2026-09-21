'use client'

import { useCart } from '@/providers/Cart'
import { Grid, Home, Search, ShoppingBag, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  onOpenMobileMenu: () => void
  onOpenSearch: () => void
  onOpenCart: () => void
  mobileMenuOpen?: boolean
  searchOverlayOpen?: boolean
}

export function BottomMobileNav({
  onOpenMobileMenu,
  onOpenSearch,
  onOpenCart,
  mobileMenuOpen = false,
  searchOverlayOpen = false,
}: Props) {
  const pathname = usePathname()
  const { itemCount } = useCart()

  // Determine active item strictly based on route / open state
  const isCatalogActive =
    mobileMenuOpen || pathname.startsWith('/shop') || pathname.startsWith('/collections')
  const isSearchActive = searchOverlayOpen || pathname === '/search'
  const isOrdersActive =
    !mobileMenuOpen &&
    !searchOverlayOpen &&
    (pathname.startsWith('/find-order') ||
      pathname.startsWith('/track-order') ||
      pathname.startsWith('/orders') ||
      pathname.startsWith('/account/orders'))
  const isBagActive = pathname === '/cart' || pathname === '/checkout'
  const isHomeActive =
    pathname === '/' &&
    !mobileMenuOpen &&
    !searchOverlayOpen &&
    !isCatalogActive &&
    !isSearchActive &&
    !isOrdersActive &&
    !isBagActive

  const getNavItemClasses = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 rounded-xl text-[10px] font-semibold tracking-wider uppercase transition-all duration-200 ${
      isActive
        ? 'text-white bg-[#648698]/35 shadow-inner'
        : 'text-[#CBCCC7]/70 hover:text-white hover:bg-white/5'
    }`

  const getIconClasses = (isActive: boolean) =>
    `h-5 w-5 mb-0.5 transition-all duration-200 ${
      isActive ? 'text-white scale-110' : 'text-[#CBCCC7]/70'
    }`

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#03171E]/95 backdrop-blur-xl border-t border-[#648698]/30 px-3 py-1.5 flex items-center justify-around shadow-2xl text-[#CBCCC7]">
      {/* Home */}
      <Link href="/" className={getNavItemClasses(isHomeActive)}>
        <Home className={getIconClasses(isHomeActive)} />
        <span>Home</span>
        {isHomeActive && <span className="absolute -bottom-0.5 w-4 h-0.5 bg-white rounded-full" />}
      </Link>

      {/* Catalog / Menu */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className={getNavItemClasses(isCatalogActive)}
        aria-label="Open categories menu"
      >
        <Grid className={getIconClasses(isCatalogActive)} />
        <span>Catalog</span>
        {isCatalogActive && (
          <span className="absolute -bottom-0.5 w-4 h-0.5 bg-white rounded-full" />
        )}
      </button>

      {/* Search */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={getNavItemClasses(isSearchActive)}
        aria-label="Search collection"
      >
        <Search className={getIconClasses(isSearchActive)} />
        <span>Search</span>
        {isSearchActive && (
          <span className="absolute -bottom-0.5 w-4 h-0.5 bg-white rounded-full" />
        )}
      </button>

      {/* Track Orders */}
      <Link href="/find-order" className={getNavItemClasses(isOrdersActive)}>
        <UserCheck className={getIconClasses(isOrdersActive)} />
        <span>Orders</span>
        {isOrdersActive && (
          <span className="absolute -bottom-0.5 w-4 h-0.5 bg-white rounded-full" />
        )}
      </Link>

      {/* Cart / Bag */}
      <button
        type="button"
        onClick={onOpenCart}
        className={getNavItemClasses(isBagActive)}
        aria-label="View shopping bag"
      >
        <div className="relative">
          <ShoppingBag className={getIconClasses(isBagActive)} />
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 bg-white text-[#03171E] font-extrabold text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-[#03171E] shadow-sm">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </div>
        <span>Bag</span>
        {isBagActive && <span className="absolute -bottom-0.5 w-4 h-0.5 bg-white rounded-full" />}
      </button>
    </div>
  )
}
