// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  report: vi.fn(),
  initialize: vi.fn(),
  find: vi.fn(),
  audit: vi.fn(),
  count: vi.fn(),
  stats: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/lib/reports/service', () => ({
  getOperationalReport: mock.report,
  initializeReports: mock.initialize,
  REPORT_EXPORTS: 'private-report-audits',
}))
vi.mock('@/utilities/commerceDatabase', () => ({
  mongoCommerce: () => ({ db: { collection: () => ({ insertOne: mock.audit }) } }),
}))
vi.mock('@/utilities/orderReport', () => ({ getOrderStats: mock.stats }))
import { GET } from '@/app/api/admin/reports/route'
import { GET as options } from '@/app/api/admin/reports/options/route'
import { POST as initialize } from '@/app/api/admin/reports/initialize/route'
import { GET as dashboard } from '@/app/api/admin/dashboard-stats/route'
import { RequestError } from '@/utilities/apiSecurity'
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: mock.auth, find: mock.find, count: mock.count })
  mock.auth.mockResolvedValue({ user: { id: 'admin-1', roles: ['admin'] } })
  mock.find.mockResolvedValue({ docs: [], hasNextPage: false })
  mock.report.mockResolvedValue({
    exportReady: true,
    rows: [{ id: '1', orderNumber: '=unsafe', total: 1350, email: 'private@example.invalid' }],
  })
})
const request = (query = '') => new Request(`https://store.example/api/admin/reports?${query}`)
describe('admin report endpoints', () => {
  it.each([null, { id: 'customer-1', roles: ['customer'] }])(
    'guards report, options and initialization from %#',
    async (user) => {
      mock.auth.mockResolvedValue({ user })
      const expected = user ? 403 : 401
      expect((await GET(request())).status).toBe(expected)
      expect((await GET(request('format=csv'))).status).toBe(expected)
      expect((await options(request())).status).toBe(expected)
      expect((await initialize(new Request(request().url, { method: 'POST' }))).status).toBe(
        expected,
      )
      expect(mock.report).not.toHaveBeenCalled()
      expect(mock.find).not.toHaveBeenCalled()
      expect(mock.audit).not.toHaveBeenCalled()
      expect(mock.initialize).not.toHaveBeenCalled()
    },
  )
  it('rejects invalid report inputs before aggregation', async () => {
    expect((await GET(request('view=inventory&payment=cod'))).status).toBe(400)
    expect(mock.report).not.toHaveBeenCalled()
  })
  it('returns private JSON and never converts report failures into zero totals', async () => {
    const response = await GET(request())
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    mock.report.mockRejectedValue(new Error('PRIVATE DATABASE ERROR'))
    const failed = await GET(request())
    expect(failed.status).toBe(503)
    expect(JSON.stringify(await failed.json())).not.toMatch(/PRIVATE|summary|orders/)
  })
  it('exports allowlisted CSV from the full-result mode and records a minimal audit', async () => {
    const response = await GET(request('view=orders&format=csv&page=5'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mock.report.mock.calls[0][3]).toBe(true)
    const csv = await response.text()
    expect(csv).toContain("'=unsafe")
    expect(csv).not.toContain('private@example')
    expect(mock.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        rows: 1,
        filters: expect.objectContaining({ view: 'orders', page: 1 }),
      }),
    )
    expect(JSON.stringify(mock.audit.mock.calls)).not.toContain('private@example')
  })
  it('fails closed when audit persistence is unavailable', async () => {
    mock.audit.mockRejectedValue(new Error('private-db-error'))
    expect((await GET(request('format=csv'))).status).toBe(503)
  })
  it('requires explicit export initialization and does not silently truncate oversized exports', async () => {
    mock.report.mockResolvedValue({ exportReady: false, rows: [] })
    expect((await GET(request('format=csv'))).status).toBe(503)
    mock.report.mockRejectedValue(new RequestError('Narrow filters.', 413))
    expect((await GET(request('format=csv'))).status).toBe(413)
    expect(mock.audit).not.toHaveBeenCalled()
  })
  it('enforces same-origin initialization even for an authenticated admin', async () => {
    const response = await initialize(
      new Request('https://store.example/api/admin/reports/initialize', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      }),
    )
    expect(response.status).toBe(403)
    expect(mock.initialize).not.toHaveBeenCalled()
  })
  it('limits only suggestions and uses access-controlled Local API operations', async () => {
    mock.find.mockResolvedValue({ docs: [], hasNextPage: true })
    const response = await options(request())
    expect(await response.json()).toMatchObject({ limited: true })
    for (const [call] of mock.find.mock.calls)
      expect(call).toMatchObject({
        overrideAccess: false,
        user: { id: 'admin-1' },
        limit: 200,
        depth: 0,
      })
  })
  it('old dashboard revenue agrees with the accepted-status definition without fetching all documents', async () => {
    mock.stats.mockResolvedValue({ totalOrders: 501, totalRevenue: 400000 })
    mock.count.mockResolvedValue({ totalDocs: 12 })
    const response = await dashboard(request())
    expect(await response.json()).toMatchObject({
      totalOrders: 501,
      totalProducts: 12,
      revenue: 400000,
      revenueDefinition: expect.stringContaining('not collected cash'),
    })
    expect(mock.find).not.toHaveBeenCalled()
    for (const [call] of mock.count.mock.calls)
      expect(call).toMatchObject({ overrideAccess: false, user: { id: 'admin-1' } })
  })
})
