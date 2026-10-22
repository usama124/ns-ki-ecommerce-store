import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReelCarousel } from '@/components/home/ReelCarousel'
import { CollectionLayout } from '@/components/products/CollectionLayout'
import { CollectionHeading } from '@/components/products/CollectionHeading'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root?.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})
function mountReels(count = 6) {
  act(() => root!.render(React.createElement(ReelCarousel, { count }, Array.from({ length: count }, (_, index) => React.createElement('div', { key: index }, React.createElement('button', null, 'Mute'))))))
  const track = container.querySelector('[aria-roledescription="carousel"]')! as HTMLDivElement
  let left = 0
  let width = 1000
  Object.defineProperties(track, {
    clientWidth: { get: () => width }, scrollWidth: { get: () => count * 250 },
    scrollLeft: { get: () => left, set: (value: number) => { left = value } },
  })
  for (const [index, child] of [...track.children].entries()) {
    Object.defineProperties(child, { offsetLeft: { value: index * 250 }, offsetWidth: { value: 250 } })
  }
  const scroll = vi.fn(({ left: delta }: ScrollToOptions) => {
    left = Math.max(0, Math.min(count * 250 - width, left + (delta || 0)))
    track.dispatchEvent(new Event('scroll'))
  })
  Object.defineProperty(track, 'scrollBy', { value: scroll, configurable: true })
  act(() => window.dispatchEvent(new Event('resize')))
  return { track, scroll, resize: (next: number) => { width = next; act(() => window.dispatchEvent(new Event('resize'))) } }
}
const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
describe('Discoverable reel navigation', () => {
  it('shows arrows and a range before hover, moves forward/back and disables end controls', () => {
    const { scroll } = mountReels()
    expect(container.textContent).toContain('see more')
    expect(container.textContent).toContain('Reels 1–4 of 6')
    expect(button('Previous reels').disabled).toBe(true)
    expect(button('Next reels').disabled).toBe(false)
    act(() => button('Next reels').click())
    expect(scroll).toHaveBeenCalledWith({ left: 1000, behavior: 'smooth' })
    expect(container.textContent).toContain('Reels 3–6 of 6')
    expect(button('Next reels').disabled).toBe(true)
    act(() => button('Previous reels').click())
    expect(container.textContent).toContain('Reels 1–4 of 6')
  })
  it('supports keyboard scrolling, reduced motion and resized screens without hijacking card controls', () => {
    const { track, scroll, resize } = mountReels()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    act(() => track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(scroll).toHaveBeenLastCalledWith({ left: 1000, behavior: 'auto' })
    scroll.mockClear()
    act(() => track.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(scroll).not.toHaveBeenCalled()
    resize(500)
    expect(container.textContent).toContain('Reels 3–4 of 6')
  })
  it('does not suggest hidden reels when the entire set fits', () => {
    mountReels(2)
    expect(button('Next reels').disabled).toBe(true)
    expect(container.textContent).not.toContain('see more')
  })
})
describe('Product-first collection layout', () => {
  it('keeps mobile filters collapsed initially and exposes an explicit show-products control', () => {
    act(() => root!.render(React.createElement(CollectionLayout, { search: React.createElement('input', { 'aria-label': 'Search' }), filters: React.createElement('p', null, 'Categories and sort') }, React.createElement('p', null, 'Products'))))
    const toggle = container.querySelector('button')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('aside')?.className).toContain('hidden')
    expect(container.textContent).toContain('Products')
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const close = [...container.querySelectorAll('button')].find(item => item.textContent === 'Show products')!
    act(() => close.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
  it('keeps the collection title, product count and description accessible without a large banner', () => {
    const html = renderToStaticMarkup(React.createElement(CollectionHeading, { title: 'Winter Collection', count: 12, description: 'Khaddar and velvet suits.' }))
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    expect(parsed.querySelector('h1')?.textContent).toBe('Winter Collection')
    expect(parsed.body.textContent).toContain('12 products')
    expect(parsed.querySelector('details')?.open).toBe(false)
    expect(parsed.querySelector('details')?.textContent).toContain('Khaddar and velvet suits.')
    expect(html).not.toContain('Curated')
  })
})
