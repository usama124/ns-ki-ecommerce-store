'use client'

import React, { useState } from 'react'

export function paymentQRCodeURL(media: unknown): string | null {
  if (!media || typeof media !== 'object' || !('url' in media) || typeof media.url !== 'string') return null
  if (!('mimeType' in media) || !['image/png', 'image/jpeg', 'image/webp'].includes(String(media.mimeType))) return null
  const url = media.url
  if (/[\\\u0000-\u0020]/.test(url)) return null
  return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : null
}

export function PaymentQRCode({ media, method }: { media: unknown; method: string }) {
  const url = paymentQRCodeURL(media)
  const [failedURL, setFailedURL] = useState<string | null>(null)
  if (!url || failedURL === url) return <p role="status" className="text-sm text-foreground mb-3">QR code unavailable. Please use the account details instead.</p>
  return <div className="bg-white p-4 rounded-xl border border-stone-300 mb-3">
    {/* Keep the original, uncropped QR and its quiet zone; never generate a payment QR from plain account text. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={`${method} payment QR code`} className="w-52 h-52 max-w-full object-contain" onError={() => setFailedURL(url)} />
    <p className="text-xs text-stone-700 max-w-52 mt-2">Check the recipient and amount in your payment app before confirming.</p>
  </div>
}
