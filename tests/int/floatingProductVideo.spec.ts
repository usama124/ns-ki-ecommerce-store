import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingProductVideo } from '@/components/product/FloatingProductVideo'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
let small: boolean
let reduced: boolean
let observerCallback: IntersectionObserverCallback
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(FloatingProductVideo, { src: '/reel.mp4', poster: '/poster.webp', title: 'Winter suit' })))
}
function player() { return document.querySelector('aside video')! as HTMLVideoElement }
async function click(label: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
  expect(button).toBeTruthy()
  await act(async () => button.click())
}
function visibility(selector: string, visible: boolean) {
  const target = document.querySelector(selector)!
  act(() => observerCallback([{ target, isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver))
}
beforeEach(() => {
  small = false
  reduced = false
  vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: query.includes('reduce') ? reduced : small, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { observerCallback = callback }
    observe() {}
    disconnect() {}
  })
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event('pause')) })
  document.body.innerHTML = '<section data-product-reel-inline><video></video></section><button data-product-purchase>Buy</button>'
})
afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  document.body.style.overflow = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('Floating product reel UX', () => {
  it('starts muted inline playback on arrival and provides pause, sound, expand and close controls', async () => {
    mount()
    expect(player().muted).toBe(true)
    expect(player().playsInline).toBe(true)
    expect(play).toHaveBeenCalled()
    await click('Pause product reel')
    expect(pause).toHaveBeenCalled()
    await click('Play product reel')
    await click('Unmute product reel')
    expect(player().muted).toBe(false)
    await click('Expand product reel')
    expect(document.querySelector('button[aria-label="Minimize product reel"]')?.getAttribute('aria-expanded')).toBe('true')
    await click('Minimize product reel')
    expect(document.querySelector('aside')?.getAttribute('style')).toContain('160px')
    await click('Close product reel')
    expect(document.querySelector('aside')).toBeNull()
    expect(document.querySelector('[data-product-reel-inline] video')).not.toBeNull()
  })
  it('does not autoplay with reduced motion, but permits explicit play', async () => {
    reduced = true
    mount()
    expect(play).not.toHaveBeenCalled()
    expect(player().preload).toBe('none')
    await click('Play product reel')
    expect(play).toHaveBeenCalled()
  })
  it('respects browser data saving', async () => {
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { connection: { saveData: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } }))
    mount()
    expect(play).not.toHaveBeenCalled()
    await click('Play product reel')
    expect(play).toHaveBeenCalled()
  })
  it('recovers when autoplay is rejected instead of leaving a broken or unhandled player', async () => {
    play.mockRejectedValueOnce(new Error('NotAllowedError'))
    mount()
    await act(async () => {})
    expect(document.querySelector('button[aria-label="Play product reel"]')).not.toBeNull()
    await click('Play product reel')
    expect(document.querySelector('button[aria-label="Pause product reel"]')).not.toBeNull()
  })
  it('keeps above mobile navigation and hides when mobile purchase controls enter view', () => {
    small = true
    mount()
    expect(document.querySelector('aside')?.getAttribute('style')).toContain('88px')
    visibility('[data-product-purchase]', true)
    expect(document.querySelector('aside')?.hidden).toBe(true)
    visibility('[data-product-purchase]', false)
    expect(document.querySelector('aside')?.hidden).toBe(false)
  })
  it('does not hide for desktop purchase controls on the opposite side of the page', () => {
    mount()
    visibility('[data-product-purchase]', true)
    expect(document.querySelector('aside')?.hidden).toBe(false)
  })
  it('pauses/hides while the inline reel is visible or playing, avoiding two simultaneous players', () => {
    mount()
    visibility('[data-product-reel-inline]', true)
    expect(document.querySelector('aside')?.hidden).toBe(true)
    act(() => document.querySelector('[data-product-reel-inline] video')!.dispatchEvent(new Event('play')))
    visibility('[data-product-reel-inline]', false)
    expect(document.querySelector('aside')?.hidden).toBe(true)
    act(() => document.querySelector('[data-product-reel-inline] video')!.dispatchEvent(new Event('pause')))
    expect(document.querySelector('aside')?.hidden).toBe(false)
  })
  it('stays behind lightboxes/cart and pauses while the page is scroll-locked', async () => {
    mount()
    await act(async () => { document.body.style.overflow = 'hidden' })
    expect(document.querySelector('aside')?.hidden).toBe(true)
    await act(async () => { document.body.style.overflow = '' })
    expect(document.querySelector('aside')?.hidden).toBe(false)
  })
  it('removes a failed floating player while preserving the inline fallback', async () => {
    mount()
    await act(async () => { player().dispatchEvent(new Event('error')) })
    expect(document.querySelector('aside')).toBeNull()
    expect(document.querySelector('[data-product-reel-inline]')).not.toBeNull()
  })
})
