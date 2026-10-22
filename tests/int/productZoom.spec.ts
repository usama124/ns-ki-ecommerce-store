import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gallery } from '@/components/product/Gallery'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
vi.mock('next/image', () => ({ default: ({ src, alt, className }: { src: string; alt: string; className: string }) => React.createElement('img', { src, alt, className }) }))
const gallery = [1, 2, 3].map(id => ({ image: {
  id, createdAt: '', updatedAt: '', url: `/original-${id}.webp`, width: 1600, height: 2400, alt: `Product ${id}`,
  sizes: { thumbnail: { url: `/thumb-${id}.webp`, width: 300 }, card: { url: `/card-${id}.webp`, width: 600 }, hero: { url: `/hero-${id}.webp`, width: 1600 } },
} }))
let root: Root
let container: HTMLDivElement
function pointer(target: Element, type: string, pointerType = 'mouse', x = 150, y = 200) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: 1 } })
  act(() => target.dispatchEvent(event))
}
function button(label: string) { return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)! }
function click(label: string) { act(() => button(label).click()) }
function key(value: string, target: Element | Document = document, shiftKey = false) {
  act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true })))
}
function surface(scope: ParentNode = container) {
  const element = scope.querySelector<HTMLDivElement>('[data-testid="zoom-surface"]')!
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 400 } as DOMRect)
  return element
}
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(React.createElement(Gallery, { gallery })))
})
afterEach(() => {
  act(() => root.unmount())
  document.body.replaceChildren()
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})
describe('Product image magnification', () => {
  it('zooms on mouse hover using the original, tracks the pointer, and restores normal view on leave', () => {
    const area = surface()
    expect(container.querySelector('[data-testid="image-magnifier"]')).toBeNull()
    pointer(area, 'pointerover')
    const layer = container.querySelector<HTMLDivElement>('[data-testid="image-magnifier"]')!
    expect(layer.style.transform).toBe('scale(2.5)')
    expect(layer.querySelector('img')?.getAttribute('src')).toBe('/original-1.webp')
    expect(layer.style.opacity).toBe('0')
    act(() => layer.querySelector('img')!.dispatchEvent(new Event('load')))
    expect(layer.style.opacity).toBe('1')
    pointer(area, 'pointermove', 'mouse', 225, 100)
    expect(area.style.getPropertyValue('--zoom-x')).toBe('75%')
    expect(area.style.getPropertyValue('--zoom-y')).toBe('25%')
    pointer(area, 'pointerout')
    expect(container.querySelector('[data-testid="image-magnifier"]')).toBeNull()
  })
  it('does not activate hover zoom for touch or pen input', () => {
    const area = surface()
    pointer(area, 'pointerover', 'touch')
    expect(container.querySelector('[data-testid="image-magnifier"]')).toBeNull()
    pointer(area, 'pointerout', 'touch')
    pointer(area, 'pointerover', 'pen')
    expect(container.querySelector('[data-testid="image-magnifier"]')).toBeNull()
  })
  it('clamps pointer positions at the image edges', () => {
    const area = surface()
    pointer(area, 'pointerover')
    pointer(area, 'pointermove', 'mouse', -50, 900)
    expect(area.style.getPropertyValue('--zoom-x')).toBe('0%')
    expect(area.style.getPropertyValue('--zoom-y')).toBe('100%')
  })
  it('adds real lightbox zoom instead of only enlarging the modal', () => {
    click('Zoom image')
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    click('Zoom in product image')
    expect(button('Zoom out product image').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector<HTMLElement>('[role="dialog"] [data-testid="image-magnifier"]')?.style.transform).toBe('scale(2.5)')
    click('Zoom out product image')
    expect(document.querySelector('[role="dialog"] [data-testid="image-magnifier"]')).toBeNull()
  })
  it('keeps zoom active after a mobile pan and permits a subsequent tap to zoom out', () => {
    click('Zoom image')
    click('Zoom in product image')
    const area = surface(document.querySelector('[role="dialog"]')!)
    const toggle = button('Zoom out product image')
    toggle.setPointerCapture = vi.fn()
    pointer(toggle, 'pointerdown', 'touch', 100, 100)
    pointer(toggle, 'pointermove', 'touch', 180, 250)
    pointer(toggle, 'pointerup', 'touch', 180, 250)
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(area.style.getPropertyValue('--zoom-x')).toBe('60%')
    pointer(toggle, 'pointerdown', 'touch', 180, 250)
    pointer(toggle, 'pointerup', 'touch', 180, 250)
    act(() => toggle.click())
    expect(button('Zoom in product image').getAttribute('aria-pressed')).toBe('false')
  })
  it('resets magnification on thumbnail change and navigates the current image with keyboard arrows', () => {
    pointer(surface(), 'pointerover')
    click('View image 2')
    expect(container.querySelector('[data-testid="image-magnifier"]')).toBeNull()
    click('Zoom image')
    click('Zoom in product image')
    key('ArrowRight')
    expect(document.querySelector('[role="dialog"] img')?.getAttribute('src')).toBe('/original-3.webp')
    expect(document.querySelector('[role="dialog"] [data-testid="image-magnifier"]')).toBeNull()
    key('ArrowLeft')
    expect(document.querySelector('[role="dialog"] img')?.getAttribute('src')).toBe('/original-2.webp')
  })
  it('traps lightbox focus and restores focus and scroll settings on Escape', () => {
    document.body.style.overflow = 'scroll'
    click('Zoom image')
    expect(document.activeElement).toBe(button('Close Lightbox'))
    expect(document.body.style.overflow).toBe('hidden')
    key('Tab', button('Close Lightbox'), true)
    expect(document.activeElement).toBe([...document.querySelectorAll('[role="dialog"] button')].at(-1))
    key('Tab', document.activeElement!)
    expect(document.activeElement).toBe(button('Close Lightbox'))
    key('Escape')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(button('Zoom image'))
    expect(document.body.style.overflow).toBe('scroll')
  })
  it('keeps the normal image visible if the high-resolution zoom source fails', () => {
    pointer(surface(), 'pointerover')
    const image = container.querySelector('[data-testid="image-magnifier"] img')!
    act(() => image.dispatchEvent(new Event('error')))
    expect(container.querySelector('[data-testid="image-magnifier"]')).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('unavailable')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/card-1.webp')
  })
  it('renders no gallery for an empty product', () => {
    act(() => root.render(React.createElement(Gallery, { gallery: [] })))
    expect(container.childElementCount).toBe(0)
  })
})
