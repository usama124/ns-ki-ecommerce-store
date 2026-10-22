import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const state = vi.hoisted(() => ({ path: '/shop/winter', params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useSearchParams: () => state.params, useRouter: () => ({ push: state.push }) }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement('a', { href }, children) }))
vi.mock('@/utilities/getStorefrontCategories', () => ({ getStorefrontCategories: async () => [
  { id: 1, name: 'Winter', slug: 'winter', type: 'main' },
  { id: 4, name: 'Summer', slug: 'summer', type: 'main' },
  { id: 2, name: 'Khaddar', slug: 'khaddar', type: 'subcategory', parent: 1 },
  { id: 3, name: 'Velvet', slug: 'velvet', type: 'subcategory', parent: { id: 1 } },
] }))
import { CategoryList } from '@/components/layout/search/Categories'
import { CategoryItem } from '@/components/layout/search/Categories.client'
import { FilterItem } from '@/components/layout/search/filter/FilterItem'

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  state.params = new URLSearchParams()
  state.push.mockClear()
})
describe('Collection navigation groups', () => {
  it('keeps main categories and subcategories in separate labelled lists, with parent context', async () => {
    const html = renderToStaticMarkup(await CategoryList())
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const lists = parsed.querySelectorAll('ul')
    expect(lists[0].textContent).toContain('Winter')
    expect(lists[0].textContent).not.toContain('Velvet')
    expect(lists[1].textContent).toContain('Khaddar')
    expect(lists[1].textContent).toContain('Velvet')
    expect(lists[1].textContent).toContain('Winter')
    expect(parsed.querySelector('section')?.getAttribute('aria-label')).toBe('Subcategories')
  })
  it('resets pagination when switching category, while retaining sort/search', () => {
    state.params = new URLSearchParams('category=3&page=4&sort=-createdAt&q=suit')
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root!.render(React.createElement(CategoryItem, { category: { id: 2, name: 'Khaddar', slug: 'khaddar' } })))
    act(() => container.querySelector('button')!.click())
    expect(state.push).toHaveBeenCalledWith('/shop/khaddar?sort=-createdAt&q=suit')
  })
  it('retains category filters when changing sort and resets the old page', () => {
    state.params = new URLSearchParams('category=3&page=4&q=suit')
    const html = renderToStaticMarkup(React.createElement(FilterItem, { item: { title: 'Price', slug: 'priceInUSD', reverse: false } }))
    const href = new DOMParser().parseFromString(html, 'text/html').querySelector('a')!.getAttribute('href')!
    expect(href).toContain('category=3')
    expect(href).toContain('sort=priceInUSD')
    expect(href).toContain('q=suit')
    expect(href).not.toContain('page=')
  })
})
