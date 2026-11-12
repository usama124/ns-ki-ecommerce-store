'use client'
import { useEffect, useState } from 'react'
import type { InstaReferences, InstaTracking } from '@/utilities/instaworldClient'
import { C, btnPrimary, btnSecondary, glassCard, inputStyle } from '../adminTheme'

type Props = { orderId: string; status: string; paymentMethod: string; city: string; itemLabels: string[] }
type State = { tracking: InstaTracking | null; bookingState: string | null; configured: boolean; failure?: string }
export function InstaWorldBooking({ orderId, status, paymentMethod, city, itemLabels }: Props) {
  const [state, setState] = useState<State | null>(null)
  const [references, setReferences] = useState<InstaReferences | null>(null)
  const [locationId, setLocation] = useState('')
  const [destination, setDestination] = useState('')
  const [weights, setWeights] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    fetch(`/api/admin/orders/instaworld?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store' }).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Shipment unavailable.')
      if (active) setState(result)
    }).catch(error => { if (active) setMessage(error.message) })
    return () => { active = false }
  }, [orderId])
  const run = async (action: 'book' | 'refresh') => {
    if (busy) return
    if (action === 'book' && !window.confirm('Book this order with InstaWorld? This creates a real shipment and may incur courier charges. Confirm the order address, destination, COD total and item weights before continuing.')) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/orders/instaworld', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, orderId, confirm: true, locationId: Number(locationId), city: destination, weightsKg: itemLabels.map((_, i) => Number(weights[i])) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Shipment action failed.')
      setState(result)
      setMessage(result.tracking ? 'Shipment information updated.' : 'No linked shipment yet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Shipment unavailable.')
      // A lost response can still mean the booking succeeded. Expose recovery,
      // never suggest creating a new order or a second consignment.
      const response = await fetch(`/api/admin/orders/instaworld?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store' }).catch(() => null)
      if (response?.ok) setState(await response.json())
    } finally { setBusy(false) }
  }
  return <section aria-label="InstaWorld shipment" style={{ ...glassCard, padding: 16, marginBottom: 18, display: 'grid', gap: 12 }}>
    <h3 style={{ color: C.textGold, margin: 0 }}>InstaWorld COD shipping</h3>
    {message && <p role="status">{message}</p>}
    {state && !state.configured && <p>Add INSTAWORLD_API_KEY to the server environment and redeploy to enable booking.</p>}
    {state?.tracking ? <>
      <p>Tracking: <strong>{state.tracking.trackingNumber}</strong></p>
      <p>{state.tracking.status.replace(/_/g, ' ')}</p>
      <p>Last checked: {new Date(state.tracking.checkedAt).toLocaleString('en-PK')}</p>
      <button type="button" style={btnSecondary} disabled={busy} onClick={() => run('refresh')}>{busy ? 'Checking…' : 'Refresh shipping status'}</button>
      <ol>{state.tracking.events.map((event, i) => <li key={i}>{event.status.replace(/_/g, ' ')}{event.recordedAt ? ` — ${new Date(event.recordedAt).toLocaleString('en-PK')}` : ''}</li>)}</ol>
    </> : <>
      {state?.bookingState && <p>Saved attempt: {state.bookingState}. Retry uses the original booking details; never book the same order separately in the portal.</p>}
      {status !== 'processing' || paymentMethod !== 'cod' ? <p>Booking is available only for COD orders in Processing. Prepaid shipping is not enabled in this integration.</p> : state?.configured && <>
        {!state.bookingState && <>
          <button type="button" style={btnSecondary} disabled={busy} onClick={async () => {
            setBusy(true); setMessage('')
            try {
              const response = await fetch('/api/admin/instaworld/references', { cache: 'no-store' })
              const data = await response.json()
              if (!response.ok) throw new Error(data.error || 'References unavailable.')
              setReferences(data)
              setLocation(data.locations[0] ? String(data.locations[0].id) : '')
              setDestination(data.cities.find((name: string) => name.toLowerCase() === city.trim().toLowerCase()) || '')
            } catch (error) { setMessage(error instanceof Error ? error.message : 'References unavailable.') }
            finally { setBusy(false) }
          }}>Load pickup locations and serviceable cities</button>
          {references && <>
            <label>Pickup location (managed in InstaWorld)<select aria-label="InstaWorld pickup location" style={inputStyle} value={locationId} onChange={e => setLocation(e.target.value)} disabled={busy}>
              <option value="">Select pickup</option>{references.locations.map(l => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
            </select></label>
            <p>Order destination: {city}. Provider destination must match; correct the order address if unsupported.</p>
            <label>InstaWorld destination<select aria-label="InstaWorld destination" style={inputStyle} value={destination} onChange={e => setDestination(e.target.value)} disabled={busy}>
              <option value="">Select city</option>{references.cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select></label>
            {itemLabels.map((label, index) => <label key={index}>Item {index + 1}: {label} — weight per unit (kg)<input aria-label={`Item ${index + 1} weight kg`} style={inputStyle} type="number" min="0.001" max="100" step="0.001" value={weights[index] || ''} onChange={e => setWeights(values => { const next = [...values]; next[index] = e.target.value; return next })} disabled={busy} /></label>)}
          </>}
        </>}
        <button type="button" style={btnPrimary} disabled={busy || (!state.bookingState && (!locationId || !destination || itemLabels.some((_, i) => !(Number(weights[i]) > 0))))} onClick={() => run('book')}>
          {busy ? 'Please wait…' : state.bookingState ? 'Reconcile / retry saved booking' : 'Book with InstaWorld'}
        </button>
      </>}
    </>}
    <p style={{ fontSize: 12 }}>Booking is manual. Shipping updates do not automatically change stock, order status or recorded payments. Refresh is limited to once per minute.</p>
  </section>
}
