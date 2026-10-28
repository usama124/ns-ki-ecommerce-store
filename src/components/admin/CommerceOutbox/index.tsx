'use client'

import { useState } from 'react'

export function CommerceOutbox() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (dispatch: boolean) => {
    setBusy(true)
    try {
      if (dispatch) {
        const response = await fetch('/api/admin/commerce/dispatch', { method: 'POST' })
        if (!response.ok)
          throw new Error((await response.json()).error || 'Dispatcher unavailable.')
      }
      const response = await fetch('/api/admin/commerce', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Queue unavailable.')
      const counts = result.emailOutbox
      setMessage(
        `Email queue — waiting: ${counts.pending}, processing: ${counts.processing}, sent: ${counts.sent}, needs review: ${counts.dead}`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Queue unavailable.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      aria-label="Order email delivery"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        padding: '12px 0',
      }}
    >
      <button type="button" disabled={busy} onClick={() => run(false)}>
        Check email queue
      </button>
      <button type="button" disabled={busy} onClick={() => run(true)}>
        Dispatch queued emails
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
