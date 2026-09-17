'use client'

import { Cart } from '@/components/Cart'
import { LogoIcon } from '@/components/icons/logo'
import { ChevronDown, Menu, Search, User, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Group subcategories by parent category ID
  const getSubcategories = (mainCatId: string) => {
    return subcategories.filter((sub) => {
      const parentId = typeof sub.parent === 'object' ? sub.parent?.id : sub.parent
      return parentId === mainCatId
    })
  }

  const showAnnouncement = announcementBar?.isActive !== false && announcementBar?.text

  return (
    <header className="sticky top-0 z-50 glass-header shadow-sm transition-all duration-300">
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

      {/* 2-Row Luxury Header Container (Edge-to-Edge Corner Spacing) */}
      <div className="w-full px-4 sm:px-8 lg:px-12">
        {/* ROW 1: Action Icons Left Corner | Centered Logo | Cart Right Corner */}
        <div className="flex items-center justify-between py-3 border-b border-[#648698]/15 md:border-b-0">
          {/* Left Action Icons (Pushed to Left Corner) */}
          <div className="flex items-center gap-4 sm:gap-6 w-1/3 justify-start">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-[#03171E] dark:text-[#f0f3f4] hover:text-[#648698] focus:outline-hidden"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <div className="hidden md:flex items-center gap-5">
              <Link
                href="/shop"
                aria-label="Search Collection"
                className="text-[#03171E] dark:text-[#CBCCC7] hover:text-[#648698] dark:hover:text-white transition-colors p-1"
                title="Search Collection"
              >
                <Search className="h-5 w-5" />
              </Link>
              <Link
                href="/find-order"
                aria-label="Account & Orders"
                className="text-[#03171E] dark:text-[#CBCCC7] hover:text-[#648698] dark:hover:text-white transition-colors p-1"
                title="Member / Orders"
              >
                <User className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Center Logo (Only Logo Image, Visible Size, No Text) */}
          <div className="flex justify-center items-center w-1/3">
            <Link href="/" className="flex items-center justify-center group py-1">
              <LogoIcon
                width={300}
                height={85}
                className="h-14 sm:h-16 md:h-20 max-h-24 w-auto object-contain transition-transform group-hover:scale-[1.02]"
              />
            </Link>
          </div>

          {/* Right Action Icons (Pushed to Right Corner) */}
          <div className="flex items-center justify-end gap-4 w-1/3">
            <Cart />
          </div>
        </div>

        {/* ROW 2: Centered Category Navigation (Desktop) */}
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

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-24 z-40 bg-white/95 dark:bg-[#03171E]/95 backdrop-blur-xl border-t border-[#648698]/20 overflow-y-auto px-6 py-6">
          <nav className="flex flex-col space-y-5">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7] border-b border-[#648698]/20 pb-2"
            >
              Home
            </Link>

            {mainCategories.map((cat) => {
              const subs = getSubcategories(cat.id)
              return (
                <div
                  key={cat.id}
                  className="flex flex-col space-y-2 border-b border-[#648698]/20 pb-3"
                >
                  <Link
                    href={`/shop/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#f0f3f4] flex justify-between items-center"
                  >
                    {cat.name}
                  </Link>
                  {subs.length > 0 && (
                    <div className="pl-4 flex flex-col space-y-2 pt-1">
                      {subs.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/shop/${sub.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-xs text-[#648698] uppercase tracking-wider hover:text-[#03171E] dark:hover:text-[#CBCCC7]"
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
              className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7]"
            >
              All Products
            </Link>

            <Link
              href="/track-order"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#CBCCC7]"
            >
              Track Order
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
