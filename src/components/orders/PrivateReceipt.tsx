'use client'

import { useEffect, useState } from 'react'

export function receiptFileError(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Use a JPEG, PNG or WebP image.'
  if (!file.size || file.size > 3 * 1024 * 1024)
    return 'Receipt must be non-empty and 3 MB or smaller.'
  return null
}

export async function uploadOrderReceipt(
  id: string | number,
  token: string | undefined,
  file: File,
) {
  const response = await fetch(`/api/orders/${encodeURIComponent(id)}/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, ...(token ? { 'x-order-token': token } : {}) },
    body: file,
    signal: AbortSignal.timeout(45000),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Receipt upload failed.')
}

/** No public media URL or next/image optimizer: every view rechecks order access. */
export function PrivateReceipt({
  orderId,
  token,
  readOnly = false,
}: {
  orderId: string | number
  token?: string
  readOnly?: boolean
}) {
  const [info, setInfo] = useState<{ path: string; exists: boolean; canUpload: boolean } | null>(
    null,
  )
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState(0)
  const path = `/api/orders/${encodeURIComponent(orderId)}/receipt`
  const imageURL = `${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${path}?info=1`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: token ? { 'x-order-token': token } : {},
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Receipt unavailable.')
        return result
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setInfo({ ...result, path })
          if (result.exists) setMessage('')
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message)
      })
    return () => controller.abort()
  }, [path, token, version])
  return (
    <section
      aria-label="Private payment receipt"
      style={{ padding: '16px 0', display: 'grid', gap: 12 }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600 }}>Private payment receipt</h3>
      {message && <p role="status">{message}</p>}
      {info?.path === path && info.exists && (
        <>
          <a href={imageURL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            Open receipt in a new tab
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageURL}
            alt="Payment receipt"
            referrerPolicy="no-referrer"
            style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }}
          />
        </>
      )}
      {info?.path === path && !info.exists && <p>No private receipt attached.</p>}
      {!readOnly && info?.path === path && info.canUpload && (
        <>
          <label>
            Attach receipt (optional; JPEG, PNG or WebP, up to 3 MB)
            <input
              aria-label="Payment receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0] || null
                const error = selected ? receiptFileError(selected) : null
                setMessage(error || '')
                setFile(error ? null : selected)
              }}
            />
          </label>
          <p>One receipt per order. Contact support to correct an uploaded receipt.</p>
          <button
            type="button"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return
              setBusy(true)
              setMessage('')
              try {
                await uploadOrderReceipt(orderId, token, file)
                setFile(null)
                setVersion((value) => value + 1)
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : 'Upload failed. Please try again.',
                )
                // A timed-out response may still have committed the R2 write.
                // Recheck before offering another attempt; never overwrite it.
                setVersion((value) => value + 1)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Uploading…' : 'Upload receipt securely'}
          </button>
        </>
      )}
    </section>
  )
}
