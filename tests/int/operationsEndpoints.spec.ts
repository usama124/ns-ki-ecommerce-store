// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  report: vi.fn(),
  status: vi.fn(),
  csv: vi.fn(),
  initialize: vi.fn(),
  baseline: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/lib/reports/operations', () => ({
  operationsReport: mock.report,
  operationsStatus: mock.status,
  operationsCSV: mock.csv,
}))
vi.mock('@/utilities/operationsHistory', () => ({
  initializeOperations: mock.initialize,
  captureInventoryBaselines: mock.baseline,
}))
import { GET } from '@/app/api/admin/operations/route'
import { GET as status } from '@/app/api/admin/operations/status/route'
import { POST as initialize } from '@/app/api/admin/operations/initialize/route'
import { POST as baseline } from '@/app/api/admin/operations/baseline/route'
import { RequestError } from '@/utilities/apiSecurity'
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: mock.auth })
  mock.auth.mockResolvedValue({ user: { id: 'admin-1', roles: ['admin'] } })
  mock.report.mockResolvedValue({ filters: { format: 'json' }, rows: [] })
  mock.status.mockResolvedValue({ ready: false })
  mock.baseline.mockResolvedValue({ processed: 25, nextCursor: 'next-id' })
})
const request = (post = false, body: unknown = {}, origin = 'https://store.example') =>
  new Request('https://store.example/api/admin/operations', {
    method: post ? 'POST' : 'GET',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    ...(post ? { body: JSON.stringify(body) } : {}),
  })
describe('operations API guards', () => {
  it.each([null, { roles: ['customer'] }])(
    'denies all history/setup/backfill/CSV access for %#',
    async (user) => {
      mock.auth.mockResolvedValue({ user })
      for (const response of [
        await GET(request()),
        await status(request()),
        await initialize(request(true)),
        await baseline(request(true)),
      ])
        expect(response.status).toBe(user ? 403 : 401)
      for (const call of [mock.report, mock.status, mock.initialize, mock.baseline, mock.csv])
        expect(call).not.toHaveBeenCalled()
    },
  )
  it('requires same-origin setup and baseline writes', async () => {
    expect((await initialize(request(true, {}, 'https://evil.example'))).status).toBe(403)
    expect((await baseline(request(true, {}, 'https://evil.example'))).status).toBe(403)
    expect(mock.initialize).not.toHaveBeenCalled()
    expect(mock.baseline).not.toHaveBeenCalled()
  })
  it('validates cursor input and keeps batches bounded in the service contract', async () => {
    expect((await baseline(request(true, { cursor: '$where' }))).status).toBe(400)
    const response = await baseline(request(true, { cursor: 'safe-id' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ processed: 25 })
    expect(mock.baseline).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ roles: ['admin'] }),
      'safe-id',
    )
  })
  it('returns private responses and does not pretend failures are empty history', async () => {
    expect((await status(request())).headers.get('cache-control')).toBe('private, no-store')
    mock.report.mockRejectedValue(new Error('PRIVATE-DB-ERROR'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('PRIVATE-DB-ERROR')
  })
  it('exports only through the admin service and preserves explicit oversize errors', async () => {
    mock.report.mockResolvedValue({ filters: { format: 'csv' }, rows: [] })
    mock.csv.mockResolvedValue('id,total\r\n')
    const response = await GET(request())
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    mock.report.mockRejectedValue(new RequestError('Narrow filters.', 413))
    expect((await GET(request())).status).toBe(413)
  })
})
