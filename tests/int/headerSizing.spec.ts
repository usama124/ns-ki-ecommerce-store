import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HeaderClient } from '@/components/Header/index.client'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
vi.mock('@/providers/Auth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/hooks/useScrollDirection', () => ({ useScrollDirection: () => ({ isVisible: true }) }))
vi.mock('@/components/Cart', () => ({ Cart: () => null }))
vi.mock('@/components/navigation/BottomMobileNav', () => ({ BottomMobileNav: () => null }))
vi.mock('@/components/navigation/SearchOverlay', () => ({ SearchOverlay: () => null }))
vi.mock('@/components/icons/logo', () => ({ LogoIcon: ({ className }: { className: string }) => React.createElement('svg', { 'data-logo': true, className }) }))

function renderHeader(pathname: string, announcement = true) {
  route.pathname = pathname
  const html = renderToStaticMarkup(React.createElement(HeaderClient, {
    header: {}, mainCategories: [], subcategories: [],
    announcementBar: { isActive: announcement, text: 'Free express shipping' },
  }))
  return new DOMParser().parseFromString(html, 'text/html').querySelector('header')!
}

describe('Consistent compact storefront header', () => {
  it('uses identical compact logo, announcement, row and navigation sizing on home and category pages', () => {
    const home = renderHeader('/')
    const category = renderHeader('/shop/winter-collection')
    expect(home.querySelector('[data-logo]')?.getAttribute('class')).toBe(category.querySelector('[data-logo]')?.getAttribute('class'))
    expect(home.querySelector('[data-logo]')?.getAttribute('class')).toContain('h-9 sm:h-10 md:h-11')
    expect(home.firstElementChild?.className).toBe(category.firstElementChild?.className)
    expect(home.firstElementChild?.className).toContain('py-1 text-[10px]')
    expect(home.querySelector('nav')?.className).toBe(category.querySelector('nav')?.className)
    expect(home.querySelector('nav')?.className).toContain('gap-y-0 py-1')
    expect(home.querySelector('nav')?.previousElementSibling?.className).toBe(category.querySelector('nav')?.previousElementSibling?.className)
    expect(home.querySelector('nav')?.previousElementSibling?.className).toContain('py-1')
  })
  it('retains home active styling, member links and navigation with announcement disabled', () => {
    const home = renderHeader('/', false)
    expect(home.textContent).not.toContain('Free express shipping')
    expect(home.querySelector('nav a[href="/"]')?.className).toContain('font-semibold')
    expect(home.querySelector('[aria-label="Member login or sign up"]')?.getAttribute('href')).toBe('/login')
    expect(home.querySelector('a[href="/shop"]')).not.toBeNull()
    expect(home.querySelector('a[href="/track-order"]')).not.toBeNull()
  })
})
