import React from 'react'
import { cleanup, fireEvent, render, screen } from '../helpers/checkoutDOM'
import { afterEach, expect, it } from 'vitest'
import { PaymentQRCode, paymentQRCodeURL } from '@/components/checkout/PaymentQRCode'
import { SiteSettings } from '@/globals/SiteSettings'
afterEach(cleanup)
it.each([null, undefined, 123, 'media-id', { url: 'javascript:alert(1)', mimeType: 'image/png' }, { url: '//evil.test/qr.png', mimeType: 'image/png' }, { url: '/video.mp4', mimeType: 'video/mp4' }, { url: '/qr.svg', mimeType: 'image/svg+xml' }])('rejects unsafe, unpopulated or unsupported QR %s', media => {
  expect(paymentQRCodeURL(media)).toBeNull()
})
it.each(['image/png', 'image/jpeg', 'image/webp'])('uses original %s media rather than cropped variants', mimeType => {
  expect(paymentQRCodeURL({ url: '/original.webp', mimeType, sizes: { thumbnail: { url: '/thumb.webp' } } })).toBe('/original.webp')
})
it('falls back for missing and broken QR and recovers when the image is replaced', () => {
  const { rerender } = render(React.createElement(PaymentQRCode, { media: null, method: 'Bank' }))
  expect(screen.getByRole('status').textContent).toContain('account details')
  rerender(React.createElement(PaymentQRCode, { media: { url: '/qr-1.png', mimeType: 'image/png' }, method: 'Bank' }))
  const image = screen.getByAltText('Bank payment QR code')
  expect(image.getAttribute('src')).toBe('/qr-1.png')
  expect(image.className).toContain('object-contain')
  fireEvent.error(image)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByRole('status').textContent).toContain('unavailable')
  rerender(React.createElement(PaymentQRCode, { media: { url: '/qr-2.webp', mimeType: 'image/webp' }, method: 'EasyPaisa' }))
  expect(screen.getByAltText('EasyPaisa payment QR code').getAttribute('src')).toBe('/qr-2.webp')
})
it('provides optional image upload fields for every digital payment group', () => {
  const group = SiteSettings.fields.find(field => 'name' in field && field.name === 'paymentDetails')
  if (!group || !('fields' in group)) throw new Error('Missing payment details')
  expect(group.fields).toHaveLength(3)
  for (const method of group.fields) {
    if (!('fields' in method)) throw new Error('Missing payment fields')
    const qr = method.fields.find(field => 'name' in field && field.name === 'qrCode')
    expect(qr).toMatchObject({ type: 'upload', relationTo: 'media', filterOptions: { mimeType: { in: ['image/png', 'image/jpeg', 'image/webp'] } } })
    expect(qr && 'required' in qr && qr.required).not.toBe(true)
  }
})
