'use client'

import { Cart } from '@/components/Cart'
import { LogoIcon } from '@/components/icons/logo'
import { BottomMobileNav } from '@/components/navigation/BottomMobileNav'
import { SearchOverlay } from '@/components/navigation/SearchOverlay'
import { ChevronDown, Menu, Search, User, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useScrollDirection } from '@/hooks/useScrollDirection'

type Category = {
  id: string
  name: string
  slug: string
  type: 'main' | 'subcategory'
  parent?: any
}

type Props = {
  header: any
  mainCategories: Category[]
  subcategories: Category[]
  announcementBar?: {
    isActive?: boolean
    text?: string
    link?: string
  }
}

export function HeaderClient({
  header,
  mainCategories = [],
  subcategories = [],
  announcementBar,
}: Props) {
  const pathname = usePathname()
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isVisible } = useScrollDirection()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Track scroll position for styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Automatically close open navigation drawers when header hides during downward scrolling
  useEffect(() => {
    if (!isVisible) {
      setMobileMenuOpen(false)
      setActiveMegaMenu(null)
    }
  }, [isVisible])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // Group subcategories by parent category ID
  const getSubcategories = (mainCatId: string) => {
    return subcategories.filter((sub) => {
      const parentId = typeof sub.parent === 'object' ? sub.parent?.id : sub.parent
      return parentId === mainCatId
    })
  }

  const showAnnouncement = announcementBar?.isActive !== false && announcementBar?.text

  // Helper to open cart modal
  const openCartModal = () => {
    const cartButton = document.querySelector<HTMLButtonElement>('button[data-cart-trigger="true"]')
    if (cartButton) {
      cartButton.click()
    }
  }

  // Mobile drawer — portalled to document.body so it is never clipped by the sticky header
  const mobileDrawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Slide-in drawer */}
      <div
        className={`fixed left-0 top-0 z-50 h-screen w-4/5 max-w-xs bg-white dark:bg-[#03171E] flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#648698]/20 bg-[#03171E] flex-shrink-0">
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <LogoIcon width={140} height={45} className="h-10 w-auto object-contain" />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#648698] hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable nav links */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-6 py-6 flex flex-col gap-1">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`text-sm font-semibold uppercase tracking-widest py-3 border-b border-[#648698]/15 ${
              pathname === '/' ? 'text-[#648698]' : 'text-[#03171E] dark:text-[#CBCCC7]'
            }`}
          >
            Home
          </Link>

          {mainCategories.map((cat) => {
            const subs = getSubcategories(cat.id)
            return (
              <div key={cat.id} className="border-b border-[#648698]/15">
                <Link
                  href={`/shop/${cat.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex justify-between items-center text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#f0f3f4] py-3"
                >
                  {cat.name}
                  {subs.length > 0 && <ChevronDown className="h-4 w-4 text-[#648698]" />}
                </Link>
                {subs.length > 0 && (
                  <div className="pl-4 pb-3 flex flex-col gap-2">
                    {subs.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/shop/${sub.slug}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-xs font-medium uppercase tracking-wider text-[#648698] hover:text-[#03171E] dark:hover:text-[#CBCCC7] py-1.5"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <Link
            href="/shop"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7] py-3 border-b border-[#648698]/15"
          >
            All Products
          </Link>

          <Link
            href="/track-order"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7] py-3 border-b border-[#648698]/15"
          >
            Track Order
          </Link>

          <Link
            href="/find-order"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7] py-3 border-b border-[#648698]/15"
          >
            My Orders
          </Link>
        </nav>

        {/* Footer action links */}
        <div className="flex-shrink-0 px-6 py-5 border-t border-[#648698]/20 flex flex-col gap-3">
          <Link
            href="/shop"
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full glass-button-primary text-center py-3 text-xs font-bold uppercase tracking-[0.2em] rounded-lg min-h-[44px]"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOverlayOpen} onClose={() => setSearchOverlayOpen(false)} />

      {/* Floating Bottom Mobile Nav */}
      <BottomMobileNav
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenSearch={() => setSearchOverlayOpen(true)}
        onOpenCart={() => openCartModal()}
      />

      {/* Mobile drawer portalled to body — escapes sticky header clipping */}
      {mounted && createPortal(mobileDrawer, document.body)}

      <header
        className={`sticky top-0 z-50 w-full glass-header shadow-sm transition-transform duration-300 ease-in-out ${
          !isVisible ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        {/* High-Contrast Brand Announcement Bar */}
        {showAnnouncement && (
          <div className="bg-[#03171E] text-[#CBCCC7] border-b border-[#648698]/30 text-center py-2 px-4 text-xs font-semibold tracking-widest uppercase flex items-center justify-center">
            {announcementBar.link ? (
              <Link
                href={announcementBar.link}
                className="hover:text-white hover:underline transition-colors"
              >
                {announcementBar.text}
              </Link>
            ) : (
              <span>{announcementBar.text}</span>
            )}
          </div>
        )}

        {/* 2-Row Luxury Header Container */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* ROW 1: Action Icons Left Corner | Centered Logo | Cart Right Corner */}
          <div className="flex items-center justify-between py-3 border-b border-[#648698]/15 md:border-b-0">
            {/* Left Action Icons */}
            <div className="flex items-center gap-2 sm:gap-4 w-1/3 justify-start">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#03171E] dark:text-[#f0f3f4] hover:text-[#648698] focus:outline-none"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

              <button
                onClick={() => setSearchOverlayOpen(true)}
                className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#03171E] dark:text-[#f0f3f4] hover:text-[#648698]"
                aria-label="Search Collection"
              >
                <Search className="h-5 w-5" />
              </button>

              <div className="hidden md:flex items-center gap-5">
                <button
                  onClick={() => setSearchOverlayOpen(true)}
                  aria-label="Search Collection"
                  className="text-[#03171E] dark:text-[#CBCCC7] hover:text-[#648698] dark:hover:text-white transition-colors p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Search Collection"
                >
                  <Search className="h-5 w-5" />
                </button>
                <Link
                  href="/find-order"
                  aria-label="Account & Orders"
                  className="text-[#03171E] dark:text-[#CBCCC7] hover:text-[#648698] dark:hover:text-white transition-colors p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Member / Orders"
                >
                  <User className="h-5 w-5" />
                </Link>
              </div>
            </div>

            {/* Center Logo */}
            <div className="flex justify-center items-center w-1/3 min-w-0">
              <Link href="/" className="flex items-center justify-center group py-1 min-w-0">
                <LogoIcon
                  width={240}
                  height={80}
                  className="h-12 sm:h-14 md:h-18 max-h-20 w-auto max-w-[140px] sm:max-w-[180px] md:max-w-[240px] object-contain transition-transform group-hover:scale-[1.02]"
                />
              </Link>
            </div>

            {/* Right Action Icons */}
            <div className="flex items-center justify-end gap-4 w-1/3">
              <Cart />
            </div>
          </div>

          {/* ROW 2: Centered Category Navigation (Desktop only) */}
          <nav className="hidden md:flex items-center justify-center space-x-8 py-3 border-t border-[#648698]/15">
            <Link
              href="/"
              className={`text-xs font-medium uppercase tracking-[0.18em] hover:text-[#648698] transition-colors py-1 ${
                pathname === '/'
                  ? 'text-[#648698] dark:text-[#CBCCC7] font-semibold border-b border-[#648698]'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              Home
            </Link>

            {mainCategories.map((cat) => {
              const subs = getSubcategories(cat.id)
              const hasSubs = subs.length > 0
              const isActive = pathname.includes(`/shop/${cat.slug}`)

              return (
                <div
                  key={cat.id}
                  className="relative group py-1"
                  onMouseEnter={() => setActiveMegaMenu(cat.id)}
                  onMouseLeave={() => setActiveMegaMenu(null)}
                >
                  <Link
                    href={`/shop/${cat.slug}`}
                    className={`flex items-center gap-1 text-xs font-medium uppercase tracking-[0.18em] hover:text-[#648698] transition-colors ${
                      isActive
                        ? 'text-[#648698] dark:text-[#CBCCC7] font-semibold border-b border-[#648698]'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {cat.name}
                    {hasSubs && (
                      <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180 text-[#648698]" />
                    )}
                  </Link>

                  {/* Mega Menu Dropdown */}
                  {hasSubs && (
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 top-full w-64 bg-white/95 dark:bg-[#03171E]/95 backdrop-blur-xl border border-[#648698]/30 shadow-2xl rounded-lg py-4 px-6 transition-all duration-200 ${
                        activeMegaMenu === cat.id
                          ? 'opacity-100 visible translate-y-0'
                          : 'opacity-0 invisible -translate-y-2'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-[#648698] mb-3 border-b border-[#648698]/20 pb-2">
                        {cat.name} Collections
                      </div>
                      <div className="flex flex-col space-y-2.5">
                        {subs.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/shop/${sub.slug}`}
                            className="text-xs text-gray-700 dark:text-gray-300 hover:text-[#648698] hover:font-semibold tracking-wider transition-colors py-0.5"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <Link
              href="/shop"
              className={`text-xs font-medium uppercase tracking-[0.18em] hover:text-[#648698] transition-colors py-1 ${
                pathname === '/shop'
                  ? 'text-[#648698] dark:text-[#CBCCC7] font-semibold border-b border-[#648698]'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              All Products
            </Link>

            <Link
              href="/track-order"
              className={`text-xs font-medium uppercase tracking-[0.18em] hover:text-[#648698] transition-colors py-1 ${
                pathname === '/track-order'
                  ? 'text-[#648698] dark:text-[#CBCCC7] font-semibold border-b border-[#648698]'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              Track Order
            </Link>
          </nav>
        </div>
      </header>
    </>
  )
}
