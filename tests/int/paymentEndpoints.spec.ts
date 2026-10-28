// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  record: vi.fn(),
  status: vi.fn(),
  initialize: vi.fn(),
  report: vi.fn(),
  csv: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/paymentLedger', () => ({
  recordMoney: mock.record,
  moneyStatus: mock.status,
  initializeMoney: mock.initialize,
}))
vi.mock('@/lib/payments/report', () => ({ moneyReport: mock.report, moneyCSV: mock.csv }))
import { GET, POST } from '@/app/api/admin/payments/route'
import { GET as status } from '@/app/api/admin/payments/status/route'
import { POST as initialize } from '@/app/api/admin/payments/initialize/route'
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: mock.auth })
  mock.auth.mockResolvedValue({ user: { id: 'admin-1', roles: ['admin'] } })
  mock.status.mockResolvedValue({ ready: false })
  mock.report.mockResolvedValue({ filters: { format: 'json' }, rows: [] })
})
const req = (write = false, body: unknown = {}, origin = 'https://store.example') =>
  new Request('https://store.example/api/admin/payments', {
    method: write ? 'POST' : 'GET',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    ...(write ? { body: JSON.stringify(body) } : {}),
  })
it.each([null, { roles: ['customer'] }])(
  'denies money reads, CSV, recording and setup %#',
  async (user) => {
    mock.auth.mockResolvedValue({ user })
    for (const response of [
      await GET(req()),
      await status(req()),
      await POST(req(true)),
      await initialize(req(true)),
    ])
      expect(response.status).toBe(user ? 403 : 401)
    for (const service of [mock.report, mock.csv, mock.status, mock.record, mock.initialize])
      expect(service).not.toHaveBeenCalled()
  },
)
it('rejects cross-origin recording/setup and bounds the actual request bytes', async () => {
  expect((await POST(req(true, {}, 'https://evil.example'))).status).toBe(403)
  expect((await initialize(req(true, {}, 'https://evil.example'))).status).toBe(403)
  expect((await POST(req(true, { extra: 'x'.repeat(2100) }))).status).toBe(413)
  expect(mock.record).not.toHaveBeenCalled()
})
it('uses trusted admin identity and hides unexpected database errors', async () => {
  mock.record.mockResolvedValue({ id: 'entry', replayed: true })
  const response = await POST(req(true, { key: 'same-key' }))
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mock.record).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: 'admin-1' }),
    { key: 'same-key' },
  )
  mock.report.mockRejectedValue(new Error('PRIVATE-DB-ERROR'))
  const failed = await GET(req())
  expect(failed.status).toBe(503)
  expect(JSON.stringify(await failed.json())).not.toContain('PRIVATE-DB-ERROR')
})
it('exports only through the bounded audited service', async () => {
  mock.report.mockResolvedValue({ filters: { format: 'csv' }, rows: [] })
  mock.csv.mockResolvedValue('safe,csv\r\n')
  const response = await GET(req())
  expect(response.headers.get('content-type')).toContain('text/csv')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.text()).toBe('safe,csv\r\n')
})
