import React, { act, StrictMode, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { CartProvider, useCart } from '@/providers/Cart'
import { chooseConsent, startAnalytics, stopAnalytics } from '@/lib/analytics/client'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let api: ReturnType<typeof useCart>
const line = {
  productId: 'qa-1',
  slug: 'qa-suit',
  title: 'Synthetic QA suit',
  variantSize: 'M',
  price: 1000,
  stock: 3,
}
function Harness() {
  const cart = useCart()
  useLayoutEffect(() => {
    api = cart
  }, [cart])
  return React.createElement('div', null, cart.itemCount)
}
function mount() {
  root = createRoot(document.createElement('div'))
  act(() =>
    root.render(
      React.createElement(
        StrictMode,
        null,
        React.createElement(CartProvider, null, React.createElement(Harness)),
      ),
    ),
  )
}
const events = () => vi.mocked(window.gtag!).mock.calls.filter((call) => call[0] === 'event')
beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/shop')
  window.gtag = vi.fn()
  document.getElementById('nski-analytics-loader')?.remove()
  chooseConsent('granted')
  startAnalytics({ enabled: true, id: 'G-TEST123', origin: window.location.origin })
})
afterEach(() => {
  act(() => root?.unmount())
  stopAnalytics()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('actual CartProvider analytics ownership', () => {
  it('counts batched successful actions once, not StrictMode updater invocations', () => {
    mount()
    act(() => {
      api.addItem(line)
      api.addItem(line)
    })
    expect(api.itemCount).toBe(2)
    expect(events().map((call) => call[1])).toEqual(['add_to_cart', 'add_to_cart'])
    act(() => api.addItem({ ...line, quantity: 2 }))
    expect(api.itemCount).toBe(2)
    expect(events()).toHaveLength(2)
    act(() => api.updateQuantity('qa-1', 'M', undefined, 1))
    act(() => api.removeItem('qa-1', 'M'))
    expect(events().map((call) => call[1])).toEqual([
      'add_to_cart',
      'add_to_cart',
      'remove_from_cart',
      'remove_from_cart',
    ])
    expect(api.itemCount).toBe(0)
  })
  it('does not call restoration or checkout cart clearing a user add/removal', () => {
    localStorage.setItem('nski_cart', JSON.stringify([{ ...line, quantity: 2 }]))
    mount()
    expect(api.itemCount).toBe(2)
    expect(events()).toHaveLength(0)
    act(() => api.clearCart())
    expect(api.itemCount).toBe(0)
    expect(events()).toHaveLength(0)
  })
  it('does not track automatic stock corrections', async () => {
    mount()
    act(() => api.addItem(line))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: false,
          adjustments: [
            {
              productId: 'qa-1',
              variantSize: 'M',
              availableStock: 0,
              title: 'Synthetic QA suit',
            },
          ],
        }),
      }),
    )
    await act(async () => {
      await api.validateCartStock()
    })
    expect(api.itemCount).toBe(0)
    expect(events()).toHaveLength(1)
    expect(events()[0][1]).toBe('add_to_cart')
  })
  it('continues shopping with denied consent and blocked storage removal', () => {
    chooseConsent('denied')
    mount()
    act(() => api.addItem(line))
    expect(api.itemCount).toBe(1)
    expect(events()).toHaveLength(0)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('restricted storage')
    })
    expect(() => act(() => api.clearCart())).not.toThrow()
    expect(api.itemCount).toBe(0)
  })
})
