export const reportViews = ['overview', 'orders', 'products', 'inventory', 'payments'] as const
export type ReportView = (typeof reportViews)[number]
export const acceptedStatuses = ['confirmed', 'processing', 'shipped', 'delivered'] as const
export const statuses = ['pending_verification', ...acceptedStatuses, 'cancelled'] as const
export const paymentMethods = ['cod', 'bank_transfer', 'jazzcash', 'easypaisa'] as const
export const presets = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'previousMonth',
  'custom',
] as const
export type Preset = (typeof presets)[number]
export function karachiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day']
    .map((part) => parts.find((value) => value.type === part)!.value)
    .join('-')
}
export function offsetDay(day: string, offset: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
}
export function presetDates(preset: Preset, now = new Date()) {
  const today = karachiDate(now),
    first = `${today.slice(0, 7)}-01`
  if (preset === 'yesterday') return { start: offsetDay(today, -1), end: offsetDay(today, -1) }
  if (preset === 'last7') return { start: offsetDay(today, -6), end: today }
  if (preset === 'last30' || preset === 'custom')
    return { start: offsetDay(today, -29), end: today }
  if (preset === 'thisMonth') return { start: first, end: today }
  if (preset === 'previousMonth') {
    const end = offsetDay(first, -1)
    return { start: `${end.slice(0, 7)}-01`, end }
  }
  return { start: today, end: today }
}
export function periodChange(current: number, previous: number) {
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : ((current - previous) / previous) * 100,
  }
}
export type ReportFilters = {
  view: ReportView
  start: string
  end: string
  status: string
  payment: string
  product: string
  category: string
  city: string
  courier: string
  stock: string
  threshold: number
  sort: string
  page: number
}
export type ReportRow = Record<string, string | number | boolean | null>
export type ReportResult = {
  filters: ReportFilters
  generatedAt: string
  dateBasis: string
  definition: string
  summary: Record<string, number | null>
  comparison: Record<string, ReturnType<typeof periodChange>> | null
  breakdowns: { status: ReportRow[]; payment: ReportRow[]; courier: ReportRow[] }
  trend: ReportRow[]
  rows: ReportRow[]
  pagination: { page: number; totalPages: number; totalRows: number; pageSize: number }
  unavailable: string[]
  exportReady: boolean
}
