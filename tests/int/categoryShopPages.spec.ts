import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Where } from 'payload'
import { ProductPagination, productPage } from '@/components/products/ProductPagination'

const mocks = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ find: mocks.find }) }))
vi.mock('@/utilities/getStorefrontCategories', () => ({ getStorefrontCategories: async () => [
  { id: 1, name: 'Winter', slug: 'winter', type: 'main' },
  { id: 2, name: 'Khaddar', slug: 'khaddar', parent: 1, type: 'subcategory' },
  { id: 3, name: 'Velvet', slug: 'velvet', parent: 1, type: 'subcategory' },
  { id: 4, name: 'Summer', slug: 'summer', type: 'main' },
] }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
import CategoryPage from '@/app/(app)/shop/[category]/page'
import ShopPage from '@/app/(app)/shop/page'

const products = [
  { title: 'Khaddar suit', categories: [2], primaryCategory: 1, status: 'published' },
  { title: 'Velvet suit', categories: [3], primaryCategory: 1, status: 'published' },
  { title: 'Both', categories: [2, 3], primaryCategory: 1, status: 'published' },
  { title: 'Main', categories: [1], primaryCategory: 1, status: 'published' },
  { title: 'Summer', categories: [4], primaryCategory: 4, status: 'published' },
  { title: 'Draft', categories: [3], primaryCategory: 1, status: 'draft' },
]
type Product = typeof products[number]
function matches(product: Product, where: Where): boolean {
  if (where.and) return where.and.every(clause => matches(product, clause))
  if (where.or) return where.or.some(clause => matches(product, clause))
  return Object.entries(where).every(([key, condition]) => {
    if (Array.isArray(condition)) return false
    const value = product[key as keyof Product]
    const allowed = condition.in
    if (Array.isArray(allowed)) return (Array.isArray(value) ? value : [value]).some(item => allowed.map(String).includes(String(item)))
    if (typeof condition.contains === 'string') return String(value).includes(condition.contains)
    return value === condition.equals
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockImplementation(async ({ where, page }: { where: Where; page: number }) => ({ docs: products.filter(product => matches(product, where)), totalPages: 2, page }))
})
describe('Category filtering on both shop routes', () => {
  it.each(['winter', '1'])('includes all published child products for parent %s, once each', async category => {
    await CategoryPage({ params: Promise.resolve({ category }), searchParams: Promise.resolve({}) })
    const query = mocks.find.mock.calls[0][0]
    expect(products.filter(product => matches(product, query.where)).map(product => product.title)).toEqual(['Khaddar suit', 'Velvet suit', 'Both', 'Main'])
    expect(query).toMatchObject({ overrideAccess: false, depth: 1, limit: 50 })
  })
  it.each([['khaddar', ['Khaddar suit', 'Both']], ['velvet', ['Velvet suit', 'Both']]])('keeps %s isolated from its sibling', async (category, expected) => {
    await CategoryPage({ params: Promise.resolve({ category: String(category) }), searchParams: Promise.resolve({}) })
    expect(products.filter(product => matches(product, mocks.find.mock.calls[0][0].where)).map(product => product.title)).toEqual(expected)
  })
  it('uses the same branch filter for query-string category, while preserving search/sort/page', async () => {
    await ShopPage({ searchParams: Promise.resolve({ category: 'winter', sort: '-priceInUSD', q: 'suit', page: '2' }) })
    const query = mocks.find.mock.calls[0][0]
    expect(query).toMatchObject({ sort: '-basePricePKR', page: 2, overrideAccess: false })
    expect(products.filter(product => matches(product, query.where)).map(product => product.title)).toEqual(['Khaddar suit', 'Velvet suit'])
  })
  it('keeps the full shop unfiltered by category and unknown category routes as 404s', async () => {
    await ShopPage({ searchParams: Promise.resolve({}) })
    expect(mocks.find.mock.calls[0][0].where).toEqual({ and: [{ status: { equals: 'published' } }] })
    mocks.find.mockClear()
    await expect(CategoryPage({ params: Promise.resolve({ category: 'missing' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
    expect(mocks.find).not.toHaveBeenCalled()
  })
  it('provides page navigation that preserves category/sort/search', () => {
    const html = renderToStaticMarkup(React.createElement(ProductPagination, { page: 2, totalPages: 3, pathname: '/shop/winter', query: { category: '1', sort: '-createdAt', q: 'suit' } }))
    expect(html).toContain('category=1&amp;sort=-createdAt&amp;q=suit&amp;page=1')
    expect(html).toContain('page=3')
    expect(renderToStaticMarkup(React.createElement(ProductPagination, { page: 1, totalPages: 1, pathname: '/shop', query: {} }))).toBe('')
    for (const value of ['-2', 'NaN', '1.5', '999999999999']) expect(productPage(value)).toBe(1)
    expect(productPage('2')).toBe(2)
  })
})
