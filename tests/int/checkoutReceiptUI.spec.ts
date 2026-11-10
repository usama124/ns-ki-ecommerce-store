import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paymentDetails } from '../helpers/paymentSettings'
const mock = vi.hoisted(() => ({ push: vi.fn(), clear: vi.fn(), clearRetry: vi.fn(), upload: vi.fn() }))
vi.mock('@/providers/Cart', () => ({ useCart: () => ({ items: [{ productId: 'qa', title: 'Suit', variantSize: 'M', price: 1000, quantity: 1 }], subtotal: 1000, clearCart: mock.clear }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }))
vi.mock('@/utilities/checkoutRetryKey', () => ({ getCheckoutRetryKey: async () => ({ key: 'fixed-retry-key', clear: mock.clearRetry }) }))
vi.mock('@/components/orders/PrivateReceipt', async original => ({ ...await original<typeof import('@/components/orders/PrivateReceipt')>(), uploadOrderReceipt: mock.upload }))
import { CheckoutPage } from '@/components/checkout/CheckoutPage'
const settings = { paymentMethods: { bank_transfer: true, easypaisa: true, jazzcash: true, cod: true }, paymentDetails }
const file = () => new File(['proof'], 'payment.png', { type: 'image/png' })
function setup() {
  const view = render(React.createElement(CheckoutPage, { siteSettings: settings }))
  fireEvent.click(screen.getByRole('button', { name: /Bank \/ Raast Transfer/ }))
  fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Test Customer' } })
  fireEvent.change(screen.getByLabelText('Phone Number (+92) *'), { target: { value: '03001234567' } })
  fireEvent.change(document.getElementById('checkout-reference')!, { target: { value: 'ABC123' } })
  return view
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, orderId: 'order-1', orderNumber: '#NKI-123456', accessToken: 'test-token' }))))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('required checkout receipt control', () => {
  it('shows a prominent upload button and disables checkout without a digital receipt', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Upload payment receipt' })).toBeTruthy()
    expect((screen.getByLabelText('Payment receipt') as HTMLInputElement).required).toBe(true)
    expect((screen.getByRole('button', { name: /Complete Order/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(document.querySelector('form')!)
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Upload your payment receipt')
  })
  it('rejects invalid files and keeps completion disabled', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Payment receipt'), { target: { files: [new File(['x'], 'bad.pdf', { type: 'application/pdf' })] } })
    expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG or WebP')
    expect((screen.getByRole('button', { name: /Complete Order/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('enables completion after selecting a receipt and submits it with the order', async () => {
    setup()
    fireEvent.change(screen.getByLabelText('Payment receipt'), { target: { files: [file()] } })
    expect(screen.getByText('Selected: payment.png')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Complete Order/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(mock.push).toHaveBeenCalledOnce())
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/orders')
    expect((options!.body as FormData).get('receipt')).toBeInstanceOf(File)
    expect(JSON.parse((options!.body as FormData).get('checkout') as string).paymentMethod).toBe('bank_transfer')
    expect(mock.clear).toHaveBeenCalledOnce()
  })
  it('recovers a failed receipt upload without creating another order or clearing the cart early', async () => {
    setup()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'RECEIPT_UPLOAD_PENDING', error: 'Order saved; retry receipt.', orderId: 'order-1', orderNumber: '#NKI-123456', accessToken: 'test-token' }), { status: 503 }))
    fireEvent.change(screen.getByLabelText('Payment receipt'), { target: { files: [file()] } })
    fireEvent.submit(document.querySelector('form')!)
    await screen.findByRole('button', { name: /Retry Receipt Upload/ })
    expect(mock.clear).not.toHaveBeenCalled()
    expect(mock.push).not.toHaveBeenCalled()
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(mock.push).toHaveBeenCalledOnce())
    expect(mock.upload).toHaveBeenCalledExactlyOnceWith('order-1', 'test-token', expect.any(File))
    expect(fetch).toHaveBeenCalledOnce()
    expect(mock.clearRetry).toHaveBeenCalledOnce()
  })
  it('does not require a receipt for COD', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Cash on Delivery/ }))
    expect(screen.queryByLabelText('Payment receipt')).toBeNull()
    expect((screen.getByRole('button', { name: /Complete Order/ }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('requires a new receipt selection when switching payment methods', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Payment receipt'), { target: { files: [file()] } })
    fireEvent.click(screen.getByRole('button', { name: /EasyPaisa Wallet/ }))
    expect(screen.queryByText('Selected: payment.png')).toBeNull()
    expect((screen.getByRole('button', { name: /Complete Order/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
