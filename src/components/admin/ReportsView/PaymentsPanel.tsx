'use client'
import { useEffect, useRef, useState } from 'react'
import { presetDates } from '@/lib/reports/model'

type MoneyReport = {
  filters: Record<string, string | number>
  summary: {
    records: number
    collectedMinor: number
    refundedMinor: number
    netMovementMinor: number
  }
  order: null | {
    id: string
    orderNumber: string
    status: string
    total: number
    collectedMinor: number
    refundedMinor: number
    hasEntries: boolean
  }
  rows: Record<string, string | number | null>[]
  pagination: { page: number; totalPages: number }
}
type Draft = {
  key: string
  orderId: string
  kind: string
  amount: string
  method: string
  reason: string
  occurredAt: string
  refundOf: string
}
const pendingKey = 'nski-admin-money-pending-v1'
const pkr = (minor: number) =>
  `Rs. ${(minor / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export function PaymentsPanel() {
  const [ready, setReady] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [orderId, setOrderId] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState('')
  const [report, setReport] = useState<MoneyReport | null>(null)
  const [kind, setKind] = useState('collection'),
    [amount, setAmount] = useState(''),
    [method, setMethod] = useState('bank_transfer')
  const [reason, setReason] = useState('customer_payment'),
    [occurredAt, setOccurredAt] = useState(''),
    [refundOf, setRefundOf] = useState('')
  const [attested, setAttested] = useState(false),
    [pending, setPending] = useState<Draft | null>(null)
  const [storageError, setStorageError] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    const controller = new AbortController(),
      dates = presetDates('last30')
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setStart(dates.start)
      setEnd(dates.end)
      const now = new Date()
      setOccurredAt(
        new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
      )
      try {
        const raw = sessionStorage.getItem(pendingKey)
        if (raw) {
          const saved = JSON.parse(raw) as Draft
          if (
            raw.length > 2048 ||
            !saved ||
            ['key', 'orderId', 'kind', 'amount', 'method', 'reason', 'occurredAt', 'refundOf'].some(
              (key) => typeof saved[key as keyof Draft] !== 'string',
            )
          )
            throw new Error('Invalid pending record')
          setPending(saved)
          setKind(saved.kind)
          setAmount(saved.amount)
          setMethod(saved.method)
          setReason(saved.reason)
          setRefundOf(saved.refundOf)
          setOrderId(saved.orderId)
          const time = new Date(saved.occurredAt)
          setOccurredAt(
            new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
          )
        }
      } catch {
        setStorageError(true)
        setError(
          'Pending submission storage is unavailable or invalid. Resolve any previous submission before recording money.',
        )
      }
    })
    void fetch('/api/admin/payments/status', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Payment status unavailable.')
        if (!controller.signal.aborted) setReady(data.ready)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message)
      })
    return () => controller.abort()
  }, [])
  async function initialize() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/payments/initialize', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Initialization failed.')
      setReady(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed.')
    } finally {
      setBusy(false)
    }
  }
  async function load(page = 1, csv = false, applied = false) {
    setBusy(true)
    setError('')
    setMessage('')
    const filters = applied && report ? report.filters : { start, end, orderId }
    if (!csv) setReport(null)
    try {
      const search = new URLSearchParams(
        Object.entries(filters).map(([key, value]) => [key, String(value)]),
      )
      search.set('page', String(csv ? 1 : page))
      search.set('format', csv ? 'csv' : 'json')
      const response = await fetch(`/api/admin/payments?${search}`, { cache: 'no-store' })
      if (!response.ok)
        throw new Error((await response.json()).error || 'Money report unavailable.')
      if (csv) {
        const url = URL.createObjectURL(await response.blob()),
          anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'nski-recorded-money.csv'
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setReport(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Money report unavailable.')
    } finally {
      setBusy(false)
    }
  }
  async function submit() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (!attested) throw new Error('Confirm money actually changed hands.')
      if (!report?.order && !pending) throw new Error('Load an order first.')
      const draft = pending || {
        key: crypto.randomUUID(),
        orderId: report!.order!.id,
        kind,
        amount,
        method,
        reason,
        occurredAt: new Date(occurredAt).toISOString(),
        refundOf,
      }
      sessionStorage.setItem(pendingKey, JSON.stringify(draft))
      setPending(draft)
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await response.json()
      if (!response.ok) {
        // Only an explicit validation refusal is safe to correct as a new command.
        // Conflicts/503/network loss can include an uncertain committed result.
        if ([400, 401, 403, 413, 415, 422].includes(response.status)) {
          sessionStorage.removeItem(pendingKey)
          setPending(null)
        }
        throw new Error(data.error || 'Recording outcome uncertain. Retry this same submission.')
      }
      sessionStorage.removeItem(pendingKey)
      setPending(null)
      setAttested(false)
      setAmount('')
      setReport(null)
      setMessage(
        `Recorded ${draft.kind} (${data.replayed ? 'existing submission recovered' : 'new entry'}). Reload the report before another entry. No money transfer was initiated.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recording failed; retry the same submission.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const frozen = busy || Boolean(pending)
  return (
    <section aria-label="Recorded payments and refunds">
      <h2>Recorded payments & refunds</h2>
      <p>
        Record only money actually received or returned. This does not send money, confirm an order,
        restock items or notify Google. Missing records are unknown, not proof of non-payment.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {ready === null && !error && <p>Checking payment recording…</p>}
      {ready === false && (
        <>
          <p>
            Explicit setup creates private records/indexes only. Existing orders are not marked paid
            and no old payments are inferred.
          </p>
          <button type="button" disabled={busy} onClick={() => void initialize()}>
            Enable payment recording
          </button>
        </>
      )}
      {ready && (
        <>
          <form
            className="report-filters"
            onSubmit={(event) => {
              event.preventDefault()
              void load()
            }}
          >
            <label>
              Money from (Karachi)
              <input
                type="date"
                required
                value={start}
                disabled={frozen}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              Money through (inclusive)
              <input
                type="date"
                required
                value={end}
                disabled={frozen}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <label>
              Money order ID (optional)
              <input
                value={orderId}
                disabled={frozen}
                onChange={(event) => setOrderId(event.target.value)}
              />
            </label>
            <button disabled={frozen}>Load money report</button>
          </form>
          {pending && (
            <p role="status">
              Submission details are locked until the outcome is confirmed. Retry uses the same key.
              Do not submit again from another tab/device; if unresolved, reconcile this key with an
              administrator: {pending.key}.
            </p>
          )}
          {report && (
            <div className="report-panel">
              <p>
                Date basis: actual money event date · Asia/Karachi. Recorded timestamps in rows are
                UTC. Late entries can change earlier periods.
              </p>
              <p>
                {report.summary.records} events · Collections: {pkr(report.summary.collectedMinor)}{' '}
                · Refunds: {pkr(report.summary.refundedMinor)} · Net recorded movement:{' '}
                {pkr(report.summary.netMovementMinor)}. This is not profit, net sales or courier
                settlement.
              </p>
              {report.order && (
                <>
                  <h3>
                    Order {report.order.orderNumber} · {report.order.status}
                  </h3>
                  <p>
                    All-time recorded for this order: collections {pkr(report.order.collectedMinor)}
                    , refunds {pkr(report.order.refundedMinor)}. Order total Rs.{' '}
                    {report.order.total.toLocaleString('en-PK')}.{' '}
                    {report.order.hasEntries
                      ? 'Financial terms and deletion are locked; status changes remain separate.'
                      : 'No recorded entries; historical payment coverage is unknown.'}
                  </p>
                </>
              )}
              <button disabled={frozen} type="button" onClick={() => void load(1, true, true)}>
                Export money CSV (max 5,000)
              </button>
              <div className="report-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        'Entry ID',
                        'Order',
                        'Kind',
                        'Amount',
                        'Method',
                        'Reason',
                        'Refund of',
                        'Occurred (UTC)',
                        'Recorded (UTC)',
                        'Actor',
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={String(row.id)}>
                        {[
                          row.id,
                          row.orderNumber,
                          row.kind,
                          pkr(Number(row.amountMinor)),
                          row.method,
                          row.reason,
                          row.refundOf,
                          row.occurredAt,
                          row.recordedAt,
                          row.actorId,
                        ].map((cell, index) => (
                          <td key={index}>{cell ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="report-pagination">
                <button
                  disabled={frozen || report.pagination.page <= 1}
                  type="button"
                  onClick={() => void load(report.pagination.page - 1, false, true)}
                >
                  Previous money page
                </button>
                <span>
                  Page {report.pagination.page} of {report.pagination.totalPages}
                </span>
                <button
                  disabled={frozen || report.pagination.page >= report.pagination.totalPages}
                  type="button"
                  onClick={() => void load(report.pagination.page + 1, false, true)}
                >
                  Next money page
                </button>
              </div>
            </div>
          )}
          {(report?.order || pending) && (
            <form
              className="report-panel"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <h3>Record money for order {pending?.orderId || report?.order?.id}</h3>
              <p>
                Entries cannot be edited or deleted. Collections are capped at the order total net
                of recorded refunds. A refund must link to its collection ID and cannot exceed its
                remaining amount. Check bank/courier evidence before recording. Cancellation never
                creates a refund.
              </p>
              <fieldset disabled={frozen} className="report-filters money-entry-fields">
                <label>
                  Money event
                  <select
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value)
                      setReason(event.target.value === 'refund' ? 'return' : 'customer_payment')
                      setRefundOf('')
                    }}
                  >
                    <option value="collection">Collection</option>
                    <option value="refund">Refund</option>
                  </select>
                </label>
                <label>
                  Actual amount (PKR)
                  <input
                    required
                    inputMode="decimal"
                    pattern="[0-9]+(\.[0-9]{1,2})?"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <label>
                  Actual money method
                  <select value={method} onChange={(event) => setMethod(event.target.value)}>
                    {['cash', 'bank_transfer', 'jazzcash', 'easypaisa'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Money reason
                  <select value={reason} onChange={(event) => setReason(event.target.value)}>
                    {(kind === 'refund'
                      ? ['return', 'cancellation', 'overpayment', 'correction']
                      : ['customer_payment', 'cod_remittance']
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Actual time (your browser timezone)
                  <input
                    required
                    type="datetime-local"
                    step="1"
                    value={occurredAt}
                    onChange={(event) => setOccurredAt(event.target.value)}
                  />
                </label>
                {kind === 'refund' && (
                  <label>
                    Original collection entry ID
                    <input
                      required
                      value={refundOf}
                      onChange={(event) => setRefundOf(event.target.value)}
                    />
                  </label>
                )}
              </fieldset>
              <label className="money-attestation">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={attested}
                  onChange={(event) => setAttested(event.target.checked)}
                />
                I verified this money was actually received/returned, not merely promised.
              </label>
              <button type="submit" disabled={busy || !attested || storageError}>
                {pending ? 'Retry same money submission' : 'Record verified money event'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
