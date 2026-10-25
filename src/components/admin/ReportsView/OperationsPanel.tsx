'use client'
import { useEffect, useState } from 'react'
import { presetDates } from '@/lib/reports/model'

type Status = {
  ready: boolean
  coverageStartedAt: string | null
  currentVariants: number
  trackedVariants: number
  driftedVariants: number
}
type History = {
  dateBasis: string
  filters: Record<string, string | number>
  rows: Record<string, unknown>[]
  summary: Record<string, number>
  pagination: { page: number; totalPages: number; totalRows: number }
}
export function OperationsPanel() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [source, setSource] = useState('orders'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [recordId, setRecordId] = useState(''),
    [milestone, setMilestone] = useState('firstConfirmedAt')
  const [report, setReport] = useState<History | null>(null),
    [cursor, setCursor] = useState(''),
    [message, setMessage] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const dates = presetDates('last30')
    void fetch('/api/admin/operations/status', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Tracking status unavailable.')
        if (!controller.signal.aborted) {
          setStatus(data)
          setStart(dates.start)
          setEnd(dates.end)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Tracking status unavailable.')
      })
    return () => controller.abort()
  }, [])
  async function statusReload() {
    const response = await fetch('/api/admin/operations/status', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Tracking status unavailable.')
    setStatus(data)
  }
  async function prepare(baseline: boolean) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(
        `/api/admin/operations/${baseline ? 'baseline' : 'initialize'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: baseline ? JSON.stringify({ cursor }) : undefined,
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Operation failed.')
      if (baseline) {
        setCursor(data.nextCursor || '')
        setMessage(
          `Processed ${data.processed} products. ${data.nextCursor ? 'Capture the next batch to continue.' : 'Scan complete; existing baselines were not reset.'}`,
        )
      } else setMessage('Tracking enabled for future changes. Capture inventory baselines next.')
      await statusReload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operation failed.')
    } finally {
      setBusy(false)
    }
  }
  async function load(page = 1, exporting = false, applied = false) {
    setBusy(true)
    setError('')
    setMessage('')
    if (!exporting) setReport(null)
    try {
      const search =
        (exporting || applied) && report
          ? new URLSearchParams(
              Object.entries(report.filters).map(([key, value]) => [key, String(value)]),
            )
          : new URLSearchParams({ source, start, end, page: String(page) })
      if (!exporting && !applied) {
        if (recordId) search.set(source === 'stock' ? 'productId' : 'orderId', recordId)
        if (source === 'milestones') search.set('milestone', milestone)
      } else {
        search.set('format', exporting ? 'csv' : 'json')
        search.set('page', exporting ? '1' : String(page))
      }
      const response = await fetch(`/api/admin/operations?${search}`, { cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'History unavailable.')
      }
      if (exporting) {
        const url = URL.createObjectURL(await response.blob()),
          anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'nski-operation-history.csv'
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setMessage('History export downloaded. Dates are UTC; monetary values are PKR.')
      } else setReport(await response.json())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'History unavailable.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Historical operations">
      <h2>Historical operations</h2>
      <p>
        Order transitions and stock movements are recorded transactionally after activation. Old
        dates and payments are never inferred. First milestones exclude orders that predate
        tracking.
      </p>
      {!status && !error && <p role="status">Checking tracking coverage…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {status &&
        (!status.ready ? (
          <>
            <p>
              History is not initialized. Enable tracking during a controlled rollout; drain
              in-flight writes and capture baselines before normal operations resume.
            </p>
            <button type="button" disabled={busy} onClick={() => void prepare(false)}>
              Enable order & stock history
            </button>
          </>
        ) : (
          <>
            <p>
              Tracking started{' '}
              {new Date(status.coverageStartedAt!).toLocaleString('en-PK', {
                timeZone: 'Asia/Karachi',
              })}{' '}
              PKT. Baselines: {status.trackedVariants} of {status.currentVariants} current variants.
              Drifted variants: {status.driftedVariants}.
            </p>
            <button type="button" disabled={busy} onClick={() => void prepare(true)}>
              Capture next 25 product baselines
            </button>
            <p className="report-note">
              Opening balances are observations at each variant’s baseline time, not reconstructed
              stock at a previous date. Drift requires reconciliation; do not disable tracking or
              edit the database to bypass it.
            </p>
            <form
              className="report-filters"
              onSubmit={(event) => {
                event.preventDefault()
                void load()
              }}
            >
              <label>
                History source
                <select
                  disabled={busy}
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value)
                    setRecordId('')
                    setReport(null)
                  }}
                >
                  <option value="orders">Order change events</option>
                  <option value="stock">Stock movements</option>
                  <option value="milestones">First order milestones</option>
                </select>
              </label>
              <label>
                History from (Karachi)
                <input
                  disabled={busy}
                  type="date"
                  required
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label>
                History through (inclusive)
                <input
                  disabled={busy}
                  type="date"
                  required
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
              <label>
                {source === 'stock' ? 'History product ID' : 'History order ID'}
                <input
                  disabled={busy}
                  value={recordId}
                  maxLength={100}
                  onChange={(event) => setRecordId(event.target.value)}
                />
              </label>
              {source === 'milestones' && (
                <label>
                  Milestone
                  <select
                    disabled={busy}
                    value={milestone}
                    onChange={(event) => setMilestone(event.target.value)}
                  >
                    <option value="firstConfirmedAt">First confirmed / processing</option>
                    <option value="firstShippedAt">First shipped</option>
                    <option value="firstDeliveredAt">First delivered</option>
                  </select>
                </label>
              )}
              <button type="submit" disabled={busy}>
                Load history
              </button>
            </form>
            {report && (
              <div className="report-panel" style={{ marginTop: 18 }}>
                <p>
                  <strong>Date basis:</strong> {report.dateBasis}
                </p>
                <p>
                  {report.pagination.totalRows} matching records.{' '}
                  {report.filters.source === 'stock'
                    ? `Net tracked-stock change: ${report.summary.netStockChange}; opening observations: ${report.summary.openingRows}.`
                    : report.filters.source === 'milestones' &&
                        report.filters.milestone === 'firstConfirmedAt'
                      ? `First-confirmed order value: PKR ${report.summary.confirmedValue}. This is historical accepted value, not collected cash or current active value.`
                      : 'Change events are not distinct purchases; never sum repeated allocation snapshots as demand.'}
                </p>
                <button type="button" disabled={busy} onClick={() => void load(1, true)}>
                  Export history CSV (max 5,000)
                </button>
                {report.rows.length ? (
                  <div className="report-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {Object.keys(report.rows[0])
                            .filter((key) => key !== 'items' && key !== 'id')
                            .map((key) => (
                              <th key={key} scope="col">
                                {key}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((row) => (
                          <tr key={String(row.id)}>
                            {Object.entries(row)
                              .filter(([key]) => key !== 'items' && key !== 'id')
                              .map(([key, value]) => (
                                <td key={key}>
                                  {value === null || value === undefined
                                    ? 'Unknown'
                                    : String(value)}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>
                    No recorded history matches these filters. This does not prove nothing happened
                    before tracking.
                  </p>
                )}
                {report.rows.some((row) => Array.isArray(row.items)) && (
                  <details>
                    <summary>Order item snapshots (recorded facts)</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                      {JSON.stringify(
                        report.rows.map((row) => ({
                          recordedAt: row.recordedAt,
                          items: row.items,
                        })),
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
                <div className="report-pagination">
                  <button
                    type="button"
                    disabled={busy || report.pagination.page <= 1}
                    onClick={() => void load(report.pagination.page - 1, false, true)}
                  >
                    Previous history page
                  </button>
                  <span>
                    History page {report.pagination.page} of {report.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={busy || report.pagination.page >= report.pagination.totalPages}
                    onClick={() => void load(report.pagination.page + 1, false, true)}
                  >
                    Next history page
                  </button>
                </div>
              </div>
            )}
          </>
        ))}
    </section>
  )
}
