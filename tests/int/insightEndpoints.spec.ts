// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  status: vi.fn(),
  initialize: vi.fn(),
  report: vi.fn(),
  csv: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/lib/reports/insights', () => ({
  insightStatus: mock.status,
  initializeInsights: mock.initialize,
  insightReport: mock.report,
  insightCSV: mock.csv,
}))
import { GET } from '@/app/api/admin/insights/route'
import { GET as status } from '@/app/api/admin/insights/status/route'
import { POST } from '@/app/api/admin/insights/initialize/route'
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: mock.auth })
  mock.auth.mockResolvedValue({ user: { id: 'admin-1', roles: ['admin'] } })
  mock.status.mockResolvedValue({ ready: false })
  mock.report.mockResolvedValue({ filters: { format: 'json' }, rows: [] })
})
const req = (write = false, origin = 'https://store.example') =>
  new Request('https://store.example/api/admin/insights', {
    method: write ? 'POST' : 'GET',
    headers: { Origin: origin },
  })
it.each([null, { roles: ['customer'] }])(
  'denies insight JSON, CSV, status and setup %#',
  async (user) => {
    mock.auth.mockResolvedValue({ user })
    for (const response of [await GET(req()), await status(req()), await POST(req(true))])
      expect(response.status).toBe(user ? 403 : 401)
    for (const service of [mock.report, mock.csv, mock.status, mock.initialize])
      expect(service).not.toHaveBeenCalled()
  },
)
it('requires same-origin setup and never exposes internal errors', async () => {
  expect((await POST(req(true, 'https://evil.example'))).status).toBe(403)
  mock.report.mockRejectedValue(new Error('PRIVATE-DB-ERROR'))
  const response = await GET(req())
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain('PRIVATE-DB-ERROR')
})
it('returns private reports and exports only through the audited service', async () => {
  expect((await status(req())).headers.get('cache-control')).toBe('private, no-store')
  mock.report.mockResolvedValue({ filters: { format: 'csv' }, rows: [] })
  mock.csv.mockResolvedValue('safe,csv\r\n')
  const response = await GET(req())
  expect(response.headers.get('content-type')).toContain('text/csv')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.text()).toBe('safe,csv\r\n')
})
