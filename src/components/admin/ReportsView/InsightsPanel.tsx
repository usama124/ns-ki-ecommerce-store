'use client'
import { useEffect, useState } from 'react'
import { presetDates } from '@/lib/reports/model'

type Status = {
  ready: boolean
  historyReady: boolean
  moneyReady: boolean
  historyStartedAt: string | null
  moneyStartedAt: string | null
}
type Report = {
  definition: string
  generatedAt: string
  filters: Record<string, string | number>
  status: Status
  summary: Record<string, number | null>
  rows: Record<string, string | number | null>[]
  pagination: { page: number; totalPages: number; totalRows: number }
}
const labels: Record<string, string> = {
  firstConfirmed: 'First confirmed orders',
  firstConfirmedValuePKR: 'Historical accepted value (PKR)',
  firstShipped: 'First shipped orders',
  firstDelivered: 'First delivered orders',
  collectedPKR: 'Recorded collections (PKR)',
  refundedPKR: 'Recorded refunds (PKR)',
  netRecordedPKR: 'Net recorded money movement (PKR)',
  variants: 'Current variants',
  untracked: 'Untracked variants',
  drifted: 'Drifted variants',
  fullWindow: 'Full-window variants',
  inactive30Plus: 'Positive-stock variants unchanged 30+ days',
  recordedAllocatedUnits: 'Recorded gross allocated units',
  recordedRestoredUnits: 'Recorded restored units',
  day: 'Karachi day',
  historyCoverage: 'History coverage',
  productId: 'Product ID',
  variantId: 'Variant ID',
  title: 'Current title',
  sku: 'Current SKU',
  stock: 'Current stock',
  coverage: 'Stock coverage',
  baselineAt: 'Baseline (UTC)',
  lastObservedChangeAt: 'Last observed stock change (UTC)',
  daysWithoutRecordedChange: 'Observed inactivity (days)',
  openingStock: 'Opening recorded stock',
  closingStock: 'Closing recorded stock',
  recordedNetChange: 'Recorded period stock delta',
  allocatedUnits: 'Gross physical allocations',
  restoredUnits: 'Physical restorations',
  allocationCoverageDays: 'Allocation coverage estimate (days)',
}
const display = (value: string | number | null | undefined, key: string) =>
  value == null
    ? 'Unavailable'
    : typeof value === 'number'
      ? value.toLocaleString('en-PK', {
          maximumFractionDigits: 2,
          minimumFractionDigits: key.endsWith('PKR') ? 2 : 0,
        })
      : value
export function InsightsPanel() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [view, setView] = useState('trends'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [productId, setProductId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/admin/insights/status', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Insight status unavailable.')
        if (!controller.signal.aborted) {
          const dates = presetDates('last30')
          setStatus(data)
          setStart(dates.start)
          setEnd(dates.end)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
    return () => controller.abort()
  }, [])
  async function initialize() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/insights/initialize', { method: 'POST' }),
        data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Insight setup failed.')
      setStatus((current) => (current ? { ...current, ready: true } : current))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Insight setup failed.')
    } finally {
      setBusy(false)
    }
  }
  async function load(page = 1, csv = false, applied = false) {
    setBusy(true)
    setError('')
    const filters =
      applied && report
        ? report.filters
        : { view, start, end, ...(view === 'stock' && productId ? { productId } : {}) }
    if (!csv) setReport(null)
    try {
      const search = new URLSearchParams(
        Object.entries(filters).map(([key, value]) => [key, String(value)]),
      )
      search.set('page', String(csv ? 1 : page))
      search.set('format', csv ? 'csv' : 'json')
      const response = await fetch(`/api/admin/insights?${search}`, { cache: 'no-store' })
      if (!response.ok) throw new Error((await response.json()).error || 'Insights unavailable.')
      if (csv) {
        const url = URL.createObjectURL(await response.blob()),
          anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'nski-historical-insights.csv'
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setReport(await response.json())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Insights unavailable.')
    } finally {
      setBusy(false)
    }
  }
  const columns =
    report?.filters.view === 'stock'
      ? [
          'productId',
          'variantId',
          'title',
          'sku',
          'stock',
          'coverage',
          'baselineAt',
          'lastObservedChangeAt',
          'daysWithoutRecordedChange',
          'openingStock',
          'closingStock',
          'recordedNetChange',
          'allocatedUnits',
          'restoredUnits',
          'allocationCoverageDays',
        ]
      : [
          'day',
          'historyCoverage',
          'firstConfirmed',
          'firstConfirmedValuePKR',
          'firstShipped',
          'firstDelivered',
          'collectedPKR',
          'refundedPKR',
          'netRecordedPKR',
        ]
  return (
    <section aria-label="Historical insights">
      <h2>Historical trends & stock inactivity</h2>
      <p>
        First milestones and recorded money have different date bases; this is not a funnel or
        conversion cohort. Physical stock age is unavailable without receipt/lot tracking.
        Inactivity measures time since a recorded change, not unit age.
      </p>
      {error && <p role="alert">{error}</p>}
      {!status && !error && <p role="status">Checking insight readiness…</p>}
      {status && (
        <>
          <p>
            History:{' '}
            {status.historyReady
              ? `enabled since ${status.historyStartedAt}`
              : 'not enabled — milestone/stock metrics unavailable'}
            . Money recording:{' '}
            {status.moneyReady
              ? `enabled since ${status.moneyStartedAt}`
              : 'not enabled — money metrics unavailable'}
            . Missing history is not reconstructed.
          </p>
          {!status.ready ? (
            <>
              <p>
                Prepare private export auditing and query indexes. This does not enable history or
                money recording, alter products/orders or send analytics.
              </p>
              <button disabled={busy} type="button" onClick={() => void initialize()}>
                Prepare insight indexes & exports
              </button>
            </>
          ) : (
            <>
              <form
                className="report-filters"
                onSubmit={(event) => {
                  event.preventDefault()
                  void load()
                }}
              >
                <label>
                  Insight view
                  <select
                    disabled={busy}
                    value={view}
                    onChange={(event) => {
                      setView(event.target.value)
                      setProductId('')
                      setReport(null)
                    }}
                  >
                    <option value="trends">Daily operational trends</option>
                    <option value="stock">Stock inactivity & allocation coverage</option>
                  </select>
                </label>
                <label>
                  Insight from (Karachi)
                  <input
                    required
                    disabled={busy}
                    type="date"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </label>
                <label>
                  Insight through (inclusive)
                  <input
                    required
                    disabled={busy}
                    type="date"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </label>
                {view === 'stock' && (
                  <label>
                    Insight product ID (optional)
                    <input
                      disabled={busy}
                      value={productId}
                      onChange={(event) => setProductId(event.target.value)}
                    />
                  </label>
                )}
                <button disabled={busy}>Load insights</button>
              </form>
              {report && (
                <>
                  <div className="report-panel">
                    <p>{report.definition}</p>
                    <p>
                      Generated {report.generatedAt}. Current data can change between requests. Zero
                      recorded money is not proof of no payment. Accepted value is not collected
                      cash; cancellation does not erase a historical first milestone.
                    </p>
                  </div>
                  <div className="report-metrics">
                    {Object.entries(report.summary).map(([key, value]) => (
                      <article className="report-panel" key={key}>
                        <h3>{labels[key] || key}</h3>
                        <p className="report-value">{display(value, key)}</p>
                      </article>
                    ))}
                  </div>
                  <div className="report-panel">
                    <p>
                      {report.pagination.totalRows} matching{' '}
                      {report.filters.view === 'stock' ? 'current variants' : 'calendar days'}.
                      Totals include all matches, not just this page.
                    </p>
                    <button type="button" disabled={busy} onClick={() => void load(1, true, true)}>
                      Export insights CSV (max 5,000)
                    </button>
                    <div className="report-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            {columns.map((key) => (
                              <th key={key}>{labels[key]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {report.rows.map((row, index) => (
                            <tr key={String(row.variantId || row.day || index)}>
                              {columns.map((key) => (
                                <td key={key}>{display(row[key], key)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="report-pagination">
                      <button
                        type="button"
                        disabled={busy || report.pagination.page <= 1}
                        onClick={() => void load(report.pagination.page - 1, false, true)}
                      >
                        Previous insight page
                      </button>
                      <span>
                        Page {report.pagination.page} of {report.pagination.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={busy || report.pagination.page >= report.pagination.totalPages}
                        onClick={() => void load(report.pagination.page + 1, false, true)}
                      >
                        Next insight page
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
