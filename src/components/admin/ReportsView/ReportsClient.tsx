'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  reportViews,
  presets,
  presetDates,
  statuses,
  paymentMethods,
  type Preset,
  type ReportFilters,
  type ReportResult,
  type ReportRow,
  type ReportView,
} from '@/lib/reports/model'
import './reports.css'

type Form = Record<keyof ReportFilters | 'preset', string>
const titles: Record<ReportView, string> = {
  overview: 'Overview',
  orders: 'Orders',
  products: 'Products',
  inventory: 'Inventory',
  payments: 'Payments & fulfillment',
}
const labels: Record<string, string> = {
  orders: 'Orders placed',
  placedValue: 'Placed order value',
  acceptedOrders: 'Currently accepted orders',
  acceptedValue: 'Currently accepted order value',
  subtotal: 'Merchandise subtotal',
  shipping: 'Shipping charges',
  codFees: 'COD charges',
  units: 'Item units',
  cancelledOrders: 'Currently cancelled',
  pendingVerification: 'Awaiting verification',
  averageAcceptedValue: 'Average accepted order value',
  cancellationRate: 'Current cancellation rate',
  codAcceptedValue: 'Accepted COD order value',
  transferAcceptedValue: 'Confirmed transfer order value',
  products: 'Product rows',
  merchandiseValue: 'Merchandise value',
  zeroOrderProducts: 'Products with zero orders',
  variants: 'Matching variants',
  stockUnits: 'Stock units now',
  inStock: 'In-stock variants',
  lowStock: 'Low stock (subset of in-stock)',
  outOfStock: 'Out-of-stock variants',
  unknownStock: 'Unknown stock',
  backorderEnabled: 'Backorder enabled',
  retailStockValue: 'Retail stock value (not cost)',
}
const moneyKeys = new Set([
  'placedValue',
  'acceptedValue',
  'subtotal',
  'shipping',
  'codFees',
  'averageAcceptedValue',
  'codAcceptedValue',
  'transferAcceptedValue',
  'merchandiseValue',
  'retailStockValue',
  'price',
  'retailValue',
  'codFee',
  'total',
  'value',
])
const money = (value: number) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 2,
  }).format(value)
const human = (value: string) =>
  (
    ({
      last7: 'Last 7 days',
      last30: 'Last 30 days',
      thisMonth: 'This month',
      previousMonth: 'Previous month',
      value_desc: 'Value: highest first',
      units_desc: 'Units: highest first',
      stock_asc: 'Stock: lowest first',
      stock_desc: 'Stock: highest first',
    }) as Record<string, string>
  )[value] || value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
function readForm(search: URLSearchParams): Form {
  const view = search.get('view') || 'overview'
  const preset = search.get('preset') || 'last30'
  const dates = presetDates(presets.includes(preset as Preset) ? (preset as Preset) : 'last30')
  const defaults: Form = {
    view,
    preset,
    ...dates,
    status: view === 'products' ? 'accepted' : 'all',
    payment: 'all',
    product: '',
    category: '',
    city: '',
    courier: '',
    stock: 'all',
    threshold: '5',
    sort: view === 'inventory' ? 'title' : view === 'products' ? 'value_desc' : 'newest',
    page: '1',
  }
  for (const key of Object.keys(defaults) as Array<keyof Form>)
    if (search.has(key)) defaults[key] = search.get(key)!
  return defaults
}
function formQuery(form: Form) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(form)) if (value) search.set(key, value)
  return search
}
const emptyForm: Form = {
  view: 'overview',
  preset: 'last30',
  start: '',
  end: '',
  status: 'all',
  payment: 'all',
  product: '',
  category: '',
  city: '',
  courier: '',
  stock: 'all',
  threshold: '5',
  sort: 'newest',
  page: '1',
}

export function ReportsClient() {
  const [query, setQuery] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [report, setReport] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [revision, setRevision] = useState(0),
    [actionBusy, setActionBusy] = useState(false),
    [actionMessage, setActionMessage] = useState('')
  const [choices, setChoices] = useState<{
    products: { id: string; title: string }[]
    categories: { id: string; title: string }[]
    limited: boolean
  }>({ products: [], categories: [], limited: false })
  const [optionsError, setOptionsError] = useState(false)
  const beginLoad = useCallback(() => {
    setLoading(true)
    setError('')
    setReport(null)
    setActionMessage('')
  }, [])
  useEffect(() => {
    const read = () => {
      beginLoad()
      const search = new URLSearchParams(window.location.search)
      const next = readForm(search)
      setForm(next)
      setQuery(search.size ? search.toString() : formQuery(next).toString())
    }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [beginLoad])
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/admin/reports/options', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!controller.signal.aborted) setChoices(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setOptionsError(true)
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (query === null) return
    const controller = new AbortController()
    void fetch(`/api/admin/reports?${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Report unavailable.')
        if (!controller.signal.aborted) setReport(data)
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Report unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [query, revision])

  function navigate(search: URLSearchParams) {
    beginLoad()
    window.history.pushState(null, '', `${window.location.pathname}?${search}`)
    setForm(readForm(search))
    setQuery(search.toString())
  }
  function changeView(view: ReportView) {
    navigate(
      formQuery({
        ...form,
        view,
        page: '1',
        status: view === 'products' ? 'accepted' : 'all',
        payment: 'all',
        category: ['products', 'inventory'].includes(view) ? form.category : '',
        city: '',
        courier: '',
        stock: 'all',
        sort: view === 'inventory' ? 'title' : view === 'products' ? 'value_desc' : 'newest',
      }),
    )
  }
  function page(next: number) {
    const search = new URLSearchParams(query || '')
    search.set('page', String(next))
    navigate(search)
  }
  async function action(initialize = false) {
    if (!report) return
    setActionBusy(true)
    setActionMessage('')
    try {
      const search = new URLSearchParams(
        Object.entries(report.filters).map(([key, value]) => [key, String(value)]),
      )
      search.set('format', 'csv')
      search.set('page', '1')
      const response = await fetch(
        initialize ? '/api/admin/reports/initialize' : `/api/admin/reports?${search}`,
        { method: initialize ? 'POST' : 'GET', cache: 'no-store' },
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Action failed.')
      }
      if (initialize) {
        beginLoad()
        setRevision((value) => value + 1)
        return
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `nski-${report.filters.view}-${report.filters.start}-${report.filters.end}.csv`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setActionMessage('Export downloaded. Includes all matching rows, not just this page.')
    } catch (reason) {
      setActionMessage(reason instanceof Error ? reason.message : 'Action failed.')
    } finally {
      setActionBusy(false)
    }
  }
  const inventory = form.view === 'inventory'
  const product = form.view === 'products'
  const field = (key: keyof Form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  return (
    <main className="nski-reports">
      <header>
        <div>
          <p className="report-eyebrow">STORE OPERATIONS · PKR</p>
          <h1>Reports</h1>
          <p>Database-backed reporting. Full matching totals, independent of table pagination.</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            beginLoad()
            setRevision((value) => value + 1)
          }}
        >
          Refresh report
        </button>
      </header>
      <nav aria-label="Report sections">
        {reportViews.map((view) => (
          <button
            type="button"
            key={view}
            aria-current={form.view === view ? 'page' : undefined}
            onClick={() => changeView(view)}
          >
            {titles[view]}
          </button>
        ))}
      </nav>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          navigate(formQuery({ ...form, page: '1' }))
        }}
        className="report-panel report-filters"
      >
        {!inventory && (
          <>
            <label>
              Period
              <select
                value={form.preset}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    preset: event.target.value,
                    ...(event.target.value === 'custom'
                      ? {}
                      : presetDates(event.target.value as Preset)),
                  }))
                }
              >
                {presets.map((value) => (
                  <option key={value} value={value}>
                    {human(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From (Karachi)
              <input
                type="date"
                required
                value={form.start}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    start: event.target.value,
                    preset: 'custom',
                  }))
                }
              />
            </label>
            <label>
              Through (inclusive)
              <input
                type="date"
                required
                value={form.end}
                onChange={(event) =>
                  setForm((current) => ({ ...current, end: event.target.value, preset: 'custom' }))
                }
              />
            </label>
            <label>
              Current order status
              <select value={form.status} onChange={(event) => field('status', event.target.value)}>
                <option value="all">All statuses</option>
                <option value="accepted">Accepted (4 active/fulfilled statuses)</option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {human(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payment method
              <select
                value={form.payment}
                onChange={(event) => field('payment', event.target.value)}
              >
                <option value="all">All methods</option>
                {paymentMethods.map((value) => (
                  <option key={value} value={value}>
                    {human(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City (exact match)
              <input
                value={form.city}
                maxLength={60}
                onChange={(event) => field('city', event.target.value)}
              />
            </label>
            <label>
              Courier
              <select
                value={form.courier}
                onChange={(event) => field('courier', event.target.value)}
              >
                <option value="">All couriers</option>
                {['TCS', 'Leopard', 'CallCourier', 'Trax', 'M&P', 'PostEx', 'Other'].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
          </>
        )}
        <label>
          Product ID
          <input
            list="report-products"
            value={form.product}
            maxLength={100}
            placeholder="All products"
            onChange={(event) => field('product', event.target.value)}
          />
        </label>
        <datalist id="report-products">
          {choices.products.map((value) => (
            <option key={value.id} value={value.id}>
              {value.title}
            </option>
          ))}
        </datalist>
        {(inventory || product) && (
          <>
            <label>
              Current primary category ID
              <input
                list="report-categories"
                value={form.category}
                maxLength={100}
                placeholder="All categories"
                onChange={(event) => field('category', event.target.value)}
              />
            </label>
            <datalist id="report-categories">
              {choices.categories.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.title}
                </option>
              ))}
            </datalist>
          </>
        )}
        {inventory && (
          <>
            <label>
              Stock state
              <select value={form.stock} onChange={(event) => field('stock', event.target.value)}>
                {['all', 'in_stock', 'low_stock', 'out_of_stock', 'unknown'].map((value) => (
                  <option key={value} value={value}>
                    {human(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Low-stock threshold
              <input
                type="number"
                min={0}
                max={10000}
                step={1}
                value={form.threshold}
                onChange={(event) => field('threshold', event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Sort
          <select value={form.sort} onChange={(event) => field('sort', event.target.value)}>
            {(inventory
              ? ['title', 'stock_asc', 'stock_desc']
              : product
                ? ['value_desc', 'units_desc', 'title']
                : ['newest', 'oldest', 'value_desc']
            ).map((value) => (
              <option key={value} value={value}>
                {human(value)}
              </option>
            ))}
          </select>
        </label>
        <button className="report-primary" type="submit" disabled={loading}>
          Apply filters
        </button>
        {(optionsError || choices.limited) && (
          <p className="report-note">
            Suggestions are {optionsError ? 'unavailable' : 'limited to 200 records'}. You can enter
            any record ID from its admin URL; report totals are not limited by suggestions.
          </p>
        )}
      </form>
      {loading && <p role="status">Loading report…</p>}
      {error && (
        <div role="alert" className="report-panel report-error">
          <strong>Report unavailable</strong>
          <p>{error}</p>
          <p>No totals are shown because the request failed.</p>
        </div>
      )}
      {report && (
        <>
          <section className="report-panel">
            <h2>{titles[report.filters.view]}</h2>
            <p>
              <strong>Date basis:</strong> {report.dateBasis}
            </p>
            <p>{report.definition}</p>
            <small>
              Generated{' '}
              {new Date(report.generatedAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}{' '}
              PKT. Current state can change between requests.
            </small>
          </section>
          <section className="report-metrics" aria-label="Report summary">
            {Object.entries(report.summary).map(([key, value]) => (
              <article className="report-panel" key={key}>
                <h3>{labels[key] || human(key)}</h3>
                <p className="report-value">
                  {value === null
                    ? 'Unavailable (no denominator)'
                    : moneyKeys.has(key)
                      ? money(value)
                      : key === 'cancellationRate'
                        ? `${value}%`
                        : value.toLocaleString('en-PK')}
                </p>
                {report.comparison?.[key] && (
                  <small>
                    Prior period: {report.comparison[key].absolute >= 0 ? '+' : ''}
                    {moneyKeys.has(key)
                      ? money(report.comparison[key].absolute)
                      : report.comparison[key].absolute.toLocaleString('en-PK')}{' '}
                    ·{' '}
                    {report.comparison[key].percent === null
                      ? 'percentage unavailable (prior zero)'
                      : `${report.comparison[key].percent.toFixed(1)}%`}
                  </small>
                )}
              </article>
            ))}
          </section>
          {report.filters.view === 'payments' && (
            <section className="report-panel">
              <h3>Collection and settlement</h3>
              <p>
                Collected COD, bank settlement, actual refunds and net paid revenue:{' '}
                <strong>Unavailable</strong>. Confirmation/delivery does not prove receipt of cash.
              </p>
            </section>
          )}
          {report.trend.length > 0 && (
            <details className="report-panel">
              <summary>
                Daily placement trend · {report.filters.start} through {report.filters.end}
              </summary>
              <DataTable rows={report.trend} columns={['day', 'orders', 'value']} />
            </details>
          )}
          {(['status', 'payment', 'courier'] as const).map(
            (key) =>
              report.breakdowns[key].length > 0 && (
                <details key={key} className="report-panel">
                  <summary>By {key} (current values)</summary>
                  <DataTable rows={report.breakdowns[key]} columns={['label', 'orders', 'value']} />
                </details>
              ),
          )}
          <section className="report-panel">
            <div className="report-table-heading">
              <h2>
                Details · {report.pagination.totalRows.toLocaleString('en-PK')} matching{' '}
                {report.filters.view === 'inventory'
                  ? 'variants'
                  : report.filters.view === 'products'
                    ? 'products'
                    : 'orders'}
              </h2>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void action(!report.exportReady)}
              >
                {actionBusy
                  ? 'Working…'
                  : report.exportReady
                    ? 'Export all matching rows (CSV)'
                    : 'Prepare reporting indexes & exports'}
              </button>
            </div>
            <p className="report-note">
              CSV is limited to 5,000 matching rows per export; larger exports fail explicitly. No
              customer contact, address, payment reference or receipt fields are included.
            </p>
            {actionMessage && <p role="status">{actionMessage}</p>}
            {report.rows.length ? (
              <DataTable
                rows={report.rows}
                columns={
                  report.filters.view === 'inventory'
                    ? [
                        'title',
                        'productStatus',
                        'category',
                        'size',
                        'sku',
                        'stock',
                        'stockState',
                        'backorder',
                        'price',
                      ]
                    : report.filters.view === 'products'
                      ? [
                          'title',
                          'productStatus',
                          'category',
                          'units',
                          'orders',
                          'merchandiseValue',
                        ]
                      : [
                          'orderNumber',
                          'createdAt',
                          'status',
                          'paymentMethod',
                          'city',
                          'courier',
                          'units',
                          'subtotal',
                          'shipping',
                          'codFee',
                          'total',
                        ]
                }
                linkType={
                  report.filters.view === 'products' || report.filters.view === 'inventory'
                    ? 'products'
                    : 'orders'
                }
              />
            ) : (
              <p>No matching rows on this page. Change filters or return to the first page.</p>
            )}
            <div className="report-pagination">
              <button
                type="button"
                disabled={report.pagination.page <= 1}
                onClick={() => page(report.pagination.page - 1)}
              >
                Previous
              </button>
              <span>
                Page {report.pagination.page} of {report.pagination.totalPages} · 50 rows per page
              </span>
              <button
                type="button"
                disabled={report.pagination.page >= report.pagination.totalPages}
                onClick={() => page(report.pagination.page + 1)}
              >
                Next
              </button>
              {report.pagination.page > report.pagination.totalPages && (
                <button type="button" onClick={() => page(1)}>
                  First page
                </button>
              )}
            </div>
          </section>
          <aside className="report-panel report-note">
            <h3>Data coverage</h3>
            <ul>
              {report.unavailable.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </aside>
        </>
      )}
    </main>
  )
}
function DataTable({
  rows,
  columns,
  linkType,
}: {
  rows: ReportRow[]
  columns: string[]
  linkType?: 'orders' | 'products'
}) {
  return (
    <div className="report-table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {human(column)}
              </th>
            ))}
            {linkType && <th scope="col">Record</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id || row.day || row.label || index}:${row.variantId || index}`}>
              {columns.map((column) => (
                <td key={column}>
                  {row[column] === null || row[column] === undefined
                    ? 'Unknown'
                    : moneyKeys.has(column) && typeof row[column] === 'number'
                      ? money(row[column])
                      : typeof row[column] === 'boolean'
                        ? row[column]
                          ? 'Yes'
                          : 'No'
                        : column === 'createdAt'
                          ? new Date(String(row[column])).toLocaleString('en-PK', {
                              timeZone: 'Asia/Karachi',
                            })
                          : String(row[column])}
                </td>
              ))}
              {linkType && (
                <td>
                  {row.id && row.productStatus !== 'unavailable' ? (
                    <a
                      href={`/store-admin/collections/${linkType}/${encodeURIComponent(String(row.id))}`}
                    >
                      Open record
                    </a>
                  ) : (
                    'Unavailable'
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
