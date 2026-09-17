'use client'

import { Cart } from '@/components/Cart'
import { LogoIcon } from '@/components/icons/logo'
import { ChevronDown, Menu, X } from 'lucide-react'
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
        <div className="bg-[#03171E] text-[#CBCCC7] border-b border-[#648698]/30 text-center py-2.5 px-4 text-xs font-semibold tracking-widest uppercase flex items-center justify-center">
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

      {/* Main Navigation Header (Luxury Glassmorphic Design) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#03171E] dark:text-[#f0f3f4] hover:text-[#648698] focus:outline-hidden"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group py-1">
            <LogoIcon
              width={45}
              height={45}
              className="object-contain transition-transform group-hover:scale-105 filter drop-shadow-sm"
            />
            <span className="font-serif text-2xl font-bold tracking-[0.2em] uppercase text-[#03171E] dark:text-[#CBCCC7] group-hover:text-[#648698] transition-colors">
              N's KI
            </span>
          </Link>

          {/* Desktop Navigation with Dynamic Megamenu */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className={`text-xs font-medium uppercase tracking-[0.15em] hover:text-[#648698] transition-colors py-2 ${
                pathname === '/'
                  ? 'border-b-2 border-[#648698] text-[#03171E] dark:text-[#CBCCC7] font-semibold'
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
                  className="relative group py-6"
                  onMouseEnter={() => setActiveMegaMenu(cat.id)}
                  onMouseLeave={() => setActiveMegaMenu(null)}
                >
                  <Link
                    href={`/shop/${cat.slug}`}
                    className={`flex items-center gap-1 text-xs font-medium uppercase tracking-[0.15em] hover:text-[#648698] transition-colors ${
                      isActive
                        ? 'text-[#03171E] dark:text-[#CBCCC7] font-bold border-b-2 border-[#648698] pb-1'
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
              className={`text-xs font-medium uppercase tracking-[0.15em] hover:text-[#648698] transition-colors ${
                pathname === '/shop'
                  ? 'border-b-2 border-[#648698] text-[#03171E] dark:text-[#CBCCC7] font-semibold'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              All Products
            </Link>

            <Link
              href="/track-order"
              className={`text-xs font-medium uppercase tracking-[0.15em] hover:text-[#648698] transition-colors ${
                pathname === '/track-order'
                  ? 'border-b-2 border-[#648698] text-[#03171E] dark:text-[#CBCCC7] font-semibold'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              Track Order
            </Link>
          </nav>

          {/* Right Action Icons (Cart) */}
          <div className="flex items-center gap-4">
            <Cart />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-20 z-40 bg-white/95 dark:bg-[#03171E]/95 backdrop-blur-xl border-t border-[#648698]/20 overflow-y-auto px-6 py-6">
          <nav className="flex flex-col space-y-6">
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
                  className="flex flex-col space-y-2 border-b border-[#648698]/20 pb-4"
                >
                  <Link
                    href={`/shop/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-semibold uppercase tracking-widest text-[#03171E] dark:text-[#f0f3f4] flex justify-between items-center"
                  >
                    {cat.name}
                  </Link>
                  {subs.length > 0 && (
                    <div className="pl-4 flex flex-col space-y-2 pt-2">
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
