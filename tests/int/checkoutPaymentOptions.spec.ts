import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('@/providers/Cart', () => ({
  useCart: () => ({
    items: [
      { productId: 'product-1', title: 'QA suit', price: 1000, quantity: 1, variantSize: 'M' },
    ],
    subtotal: 1000,
    clearCart: vi.fn(),
  }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { CheckoutPage } from '@/components/checkout/CheckoutPage'
it('shows only Bank/Raast and EasyPaisa and defaults to bank details without COD charges', () => {
  const markup = renderToStaticMarkup(
    React.createElement(CheckoutPage, { siteSettings: { shipping: { codFee: 250 } } }),
  )
  expect(markup).toContain('Bank / Raast Transfer')
  expect(markup).toContain('EasyPaisa Wallet')
  expect(markup).toContain('Meezan Bank &amp; Raast Transfer')
  expect(markup).not.toMatch(/Cash on Delivery|JazzCash|Pay cash|COD Fee/i)
})
it.each(['cod', 'bank_transfer', 'jazzcash', 'easypaisa'])(
  'renders %s when it is the only enabled method',
  (method) => {
    const paymentMethods = Object.fromEntries(
      ['cod', 'bank_transfer', 'jazzcash', 'easypaisa'].map((key) => [key, key === method]),
    )
    const markup = renderToStaticMarkup(
      React.createElement(CheckoutPage, {
        siteSettings: { paymentMethods, shipping: { codFee: 175 } },
      }),
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')
    const buttons = Array.from(document.querySelectorAll('button')).filter((button) =>
      /Cash on Delivery|Bank \/ Raast Transfer|JazzCash Wallet|EasyPaisa Wallet/.test(
        button.textContent || '',
      ),
    )
    expect(buttons).toHaveLength(1)
    expect(markup.includes('Cash on Delivery (COD) Fee')).toBe(method === 'cod')
    expect(markup.includes('Meezan Bank &amp; Raast Transfer')).toBe(method === 'bank_transfer')
    expect(markup.includes('JazzCash Wallet Transfer')).toBe(method === 'jazzcash')
  },
)
it('supports an admin checkout pause with all methods disabled', () => {
  const markup = renderToStaticMarkup(
    React.createElement(CheckoutPage, {
      siteSettings: {
        paymentMethods: { cod: false, bank_transfer: false, jazzcash: false, easypaisa: false },
      },
    }),
  )
  const document = new DOMParser().parseFromString(markup, 'text/html')
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('No payment methods')
  expect(document.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true)
})
