import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '../helpers/checkoutDOM'
vi.mock('@/providers/Cart', () => ({ useCart: () => ({
  items: [{ productId: 'qa', title: 'QA suit', price: 1000, quantity: 1 }],
  subtotal: 1000, clearCart: vi.fn(),
}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { CheckoutPage } from '@/components/checkout/CheckoutPage'
const media = (url: string) => ({ url, mimeType: 'image/png' })
afterEach(cleanup)
function clickPayment(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(text))
  if (!button) throw new Error(`Missing payment button ${text}`)
  fireEvent.click(button)
}
it('uses the selected method QR without reusing another method image', () => {
  render(React.createElement(CheckoutPage, { siteSettings: {
    paymentMethods: { cod: true, bank_transfer: true, jazzcash: true, easypaisa: true },
    paymentDetails: { bankTransfer: { bankName: 'QA Bank', qrCode: media('/bank-qr.png') }, jazzcash: { qrCode: media('/jazz-qr.png') }, easypaisa: {} },
  } }))
  expect(document.querySelector('img[alt$="payment QR code"]')).toBeNull() // COD default
  clickPayment('Bank / Raast Transfer')
  clickPayment('Scan QR Code')
  expect(screen.getByAltText('Bank / Raast payment QR code').getAttribute('src')).toBe('/bank-qr.png')
  expect(document.body.textContent).toContain('QA Bank & Raast Transfer')
  clickPayment('JazzCash Wallet')
  expect(screen.getByAltText('JazzCash payment QR code').getAttribute('src')).toBe('/jazz-qr.png')
  expect(document.querySelector('img[src="/bank-qr.png"]')).toBeNull()
  clickPayment('EasyPaisa Wallet')
  expect(document.querySelector('img[alt$="payment QR code"]')).toBeNull()
  expect(document.body.textContent).toContain('QR code unavailable')
  clickPayment('Account Details')
  expect(document.body.textContent).toContain('EasyPaisa Mobile')
  clickPayment('Cash on Delivery')
  expect(document.body.textContent).not.toContain('Scan QR Code')
  expect(document.querySelector('img[src*="qrserver"]')).toBeNull()
})
