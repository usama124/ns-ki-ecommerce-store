// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseReportFilters, reportPeriod } from '@/lib/reports/filters'
import { karachiDate, offsetDay, periodChange, presetDates } from '@/lib/reports/model'
import { csvCell, reportCSV } from '@/lib/reports/csv'
import { getOperationalReport, initializeReports } from '@/lib/reports/service'

const parse = (query = '') =>
  parseReportFilters(new URLSearchParams(query), new Date('2026-10-24T20:00:00Z'))
describe('report filters, calendar boundaries and privacy-safe CSV', () => {
  it('uses Karachi midnight, inclusive end and a contiguous equal-length prior range', () => {
    const filters = parse('start=2026-10-24&end=2026-10-25')
    expect(reportPeriod(filters)).toEqual({
      start: new Date('2026-10-23T19:00:00Z'),
      end: new Date('2026-10-25T19:00:00Z'),
      previousStart: new Date('2026-10-21T19:00:00Z'),
      previousEnd: new Date('2026-10-23T19:00:00Z'),
    })
    expect(karachiDate(new Date('2026-10-24T19:00:00Z'))).toBe('2026-10-25')
    expect(karachiDate(new Date('2026-10-24T18:59:59Z'))).toBe('2026-10-24')
  })
  it('supports leap days and all date presets without browser timezone dependence', () => {
    expect(parse('start=2024-02-29&end=2024-02-29').start).toBe('2024-02-29')
    expect(offsetDay('2024-03-01', -1)).toBe('2024-02-29')
    const now = new Date('2026-01-15T12:00:00Z')
    expect(presetDates('previousMonth', now)).toEqual({ start: '2025-12-01', end: '2025-12-31' })
    expect(presetDates('last7', now)).toEqual({ start: '2026-01-09', end: '2026-01-15' })
    expect(presetDates('thisMonth', now)).toEqual({ start: '2026-01-01', end: '2026-01-15' })
  })
  it.each([
    'start=2026-02-30&end=2026-03-01',
    'start=bad&end=2026-10-25',
    'start=2026-10-26&end=2026-10-25',
    'start=2025-01-01&end=2026-10-25',
    'start=2026-10-24',
    'preset=custom',
    'preset=bad',
    'status=wrong',
    'payment=wrong',
    'sort=$where',
    'page=0',
    'page=1.5',
    'page=100001',
    'view=unknown',
    'threshold=-1',
    'threshold=0.5',
    'threshold=10001',
    'product=$where',
    'category=%7B%7D',
    'view=orders&category=1',
    'view=inventory&payment=cod',
    'view=inventory&status=confirmed',
    'stock=low_stock',
    'city=private@example.com',
    'courier=unrecognized',
    'status=all&status=confirmed',
    'email=private@example.com',
    'format=xml',
  ])('rejects invalid, irrelevant or duplicate filters: %s', (query) => {
    expect(() => parse(query)).toThrow()
  })
  it('defaults product rankings to accepted statuses and inventory to current scope', () => {
    expect(parse('view=products')).toMatchObject({ status: 'accepted', sort: 'value_desc' })
    expect(parse('view=inventory&stock=low_stock&threshold=0')).toMatchObject({
      status: 'all',
      sort: 'title',
      threshold: 0,
    })
  })
  it('does not manufacture a percentage when the previous denominator is zero', () => {
    expect(periodChange(10, 0)).toEqual({ absolute: 10, percent: null })
    expect(periodChange(0, 10)).toEqual({ absolute: -10, percent: -100 })
  })
  it.each([
    '=HYPERLINK("x")',
    '+SUM(1)',
    '-1+2',
    '@SUM(1)',
    '  =SUM(1)',
    '\t=SUM(1)',
    '\r=SUM(1)',
    '\n=SUM(1)',
    '\uFEFF=SUM(1)',
  ])('neutralizes a spreadsheet formula %s', (value) => {
    expect(csvCell(value).startsWith('"\'')).toBe(true)
  })
  it('quotes commas, quotes and newlines; preserves numeric zero and false', () => {
    expect(csvCell('Hello,"world"\nnext')).toBe('"Hello,""world""\nnext"')
    expect(csvCell(0)).toBe('"0"')
    expect(csvCell(false)).toBe('"false"')
    expect(csvCell(null)).toBe('""')
  })
  it('CSV reconstructs allowlisted columns and excludes accidental PII/secret fields', () => {
    const csv = reportCSV(parse(), [
      {
        id: '1',
        orderNumber: '=unsafe',
        total: 0,
        email: 'private@example.invalid',
        phone: '03001112222',
        receipt: 'secret-receipt',
        transactionId: 'secret-bank',
      },
    ])
    expect(csv).not.toMatch(/private@|030011|secret-/)
    expect(csv).toContain("'=unsafe")
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
  it('native services reject non-admins independently of HTTP route guards', async () => {
    for (const user of [null, { roles: ['customer'] }]) {
      await expect(getOperationalReport({} as never, user as never, parse())).rejects.toMatchObject(
        { status: 403 },
      )
      await expect(initializeReports({} as never, user as never)).rejects.toMatchObject({
        status: 403,
      })
    }
  })
  it('fails explicitly on unsupported adapters instead of returning plausible zero totals', async () => {
    await expect(
      getOperationalReport(
        { db: { name: 'postgres' } } as never,
        { roles: ['admin'] } as never,
        parse(),
      ),
    ).rejects.toMatchObject({ status: 503 })
  })
})
