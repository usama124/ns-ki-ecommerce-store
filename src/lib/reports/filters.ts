import { RequestError } from '@/utilities/apiSecurity'
import {
  reportViews,
  statuses,
  paymentMethods,
  presets,
  presetDates,
  offsetDay,
  type ReportFilters,
  type ReportView,
  type Preset,
} from './model'

const keys = [
  'view',
  'preset',
  'start',
  'end',
  'status',
  'payment',
  'product',
  'category',
  'city',
  'courier',
  'stock',
  'threshold',
  'sort',
  'page',
  'format',
]
export function parseReportFilters(search: URLSearchParams, now = new Date()): ReportFilters {
  for (const key of search.keys())
    if (!keys.includes(key) || search.getAll(key).length !== 1)
      throw new RequestError('Invalid report filter.')
  const pick = (key: string, fallback: string) => search.get(key) || fallback
  const choice = (key: string, allowed: readonly string[], fallback: string) => {
    const value = pick(key, fallback)
    if (!allowed.includes(value)) throw new RequestError(`Invalid ${key} filter.`)
    return value
  }
  const view = choice('view', reportViews, 'overview') as ReportView
  const preset = choice('preset', presets, 'last30') as Preset
  const defaults = presetDates(preset, now)
  if (
    Boolean(search.get('start')) !== Boolean(search.get('end')) ||
    (preset === 'custom' && !search.get('start'))
  )
    throw new RequestError('Choose both report dates.')
  const start = pick('start', defaults.start),
    end = pick('end', defaults.end)
  for (const date of [start, end]) {
    const parsed = new Date(`${date}T00:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      date < '2000-01-01' ||
      date > '2100-12-31'
    )
      throw new RequestError('Invalid report date.')
  }
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1
  if (days < 1 || days > 366) throw new RequestError('Choose a report range of 1–366 days.')
  const integer = (key: string, fallback: number, maximum: number, minimum = 1) => {
    const raw = pick(key, String(fallback)),
      value = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum)
      throw new RequestError(`Invalid ${key}.`)
    return value
  }
  const id = (key: string) => {
    const value = search.get(key) || ''
    if (value && !/^[a-zA-Z0-9-]{1,100}$/.test(value)) throw new RequestError(`Invalid ${key}.`)
    return value
  }
  const status = choice(
    'status',
    ['all', 'accepted', ...statuses],
    view === 'products' ? 'accepted' : 'all',
  )
  const payment = choice('payment', ['all', ...paymentMethods], 'all')
  const category = id('category'),
    product = id('product')
  const city = search.get('city') || ''
  if (city && !/^[a-zA-Z][a-zA-Z .'-]{0,59}$/.test(city)) throw new RequestError('Invalid city.')
  const courier = choice(
    'courier',
    ['', 'TCS', 'Leopard', 'CallCourier', 'Trax', 'M&P', 'PostEx', 'Other'],
    '',
  )
  const stock = choice('stock', ['all', 'in_stock', 'low_stock', 'out_of_stock', 'unknown'], 'all')
  if (view === 'inventory' && (status !== 'all' || payment !== 'all' || city || courier))
    throw new RequestError('Order filters do not apply to current inventory.')
  if (!['products', 'inventory'].includes(view) && category)
    throw new RequestError('Category is a product/inventory filter.')
  if (view !== 'inventory' && stock !== 'all')
    throw new RequestError('Stock filters require the inventory report.')
  const sorts =
    view === 'inventory'
      ? ['title', 'stock_asc', 'stock_desc']
      : view === 'products'
        ? ['value_desc', 'units_desc', 'title']
        : ['newest', 'oldest', 'value_desc']
  choice('format', ['json', 'csv'], 'json')
  return {
    view,
    start,
    end,
    status,
    payment,
    product,
    category,
    city,
    courier,
    stock,
    threshold: integer('threshold', 5, 10000, 0),
    page: integer('page', 1, 100000),
    sort: choice('sort', sorts, sorts[0]),
  }
}
export function reportPeriod(filters: Pick<ReportFilters, 'start' | 'end'>) {
  const start = new Date(`${filters.start}T00:00:00+05:00`)
  const end = new Date(`${offsetDay(filters.end, 1)}T00:00:00+05:00`)
  return {
    start,
    end,
    previousStart: new Date(start.getTime() - (end.getTime() - start.getTime())),
    previousEnd: start,
  }
}
