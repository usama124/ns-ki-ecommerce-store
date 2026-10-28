// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  dispatch: vi.fn(),
  initialize: vi.fn(),
  status: vi.fn(),
  revoke: vi.fn(),
  limit: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/orderAnalytics', () => ({
  dispatchOrderAnalytics: mock.dispatch,
  initializeAnalytics: mock.initialize,
  orderAnalyticsStatus: mock.status,
  revokeOrderAnalytics: mock.revoke,
}))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: mock.limit }))
import { GET, POST } from '@/app/api/admin/analytics/dispatch/route'
import { POST as initialize } from '@/app/api/admin/analytics/initialize/route'
import { POST as revoke } from '@/app/api/analytics/revoke/route'
import { GET as status } from '@/app/api/admin/analytics/route'
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
  mock.getPayload.mockResolvedValue({ auth: mock.auth })
  mock.dispatch.mockResolvedValue({ accepted: 1, review: 0 })
})
afterEach(() => vi.unstubAllEnvs())
const request = (path: string, origin = 'https://store.example') =>
  new Request(`https://store.example${path}`, { method: 'POST', headers: { Origin: origin } })
describe('analytics endpoint access', () => {
  it('protects queue counts from guests and customers', async () => {
    mock.auth.mockResolvedValue({ user: null })
    expect((await status(new Request('https://store.example/api/admin/analytics'))).status).toBe(
      401,
    )
    mock.auth.mockResolvedValue({ user: { roles: ['customer'] } })
    expect((await status(new Request('https://store.example/api/admin/analytics'))).status).toBe(
      403,
    )
    expect(mock.status).not.toHaveBeenCalled()
  })
  it('rejects missing or incorrect scheduler capability before connecting to DB', async () => {
    for (const secret of ['', 'short', 'x'.repeat(32)]) {
      vi.stubEnv('ANALYTICS_WORKER_SECRET', secret)
      expect(
        (
          await GET(
            new Request('https://store.example/api/admin/analytics/dispatch', {
              headers: { Authorization: 'Bearer wrong' },
            }),
          )
        ).status,
      ).toBe(403)
    }
    expect(mock.getPayload).not.toHaveBeenCalled()
  })
  it('accepts the scheduler secret and returns only uncached aggregate results', async () => {
    vi.stubEnv('ANALYTICS_WORKER_SECRET', 'x'.repeat(32))
    const response = await GET(
      new Request('https://store.example/api/admin/analytics/dispatch', {
        headers: { Authorization: `Bearer ${'x'.repeat(32)}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ accepted: 1, review: 0 })
  })
  it.each([POST, initialize])(
    'requires an authenticated same-origin administrator %#',
    async (handler) => {
      mock.auth.mockResolvedValue({ user: null })
      expect((await handler(request('/api/admin/analytics/dispatch'))).status).toBe(401)
      mock.auth.mockResolvedValue({ user: { roles: ['customer'] } })
      expect((await handler(request('/api/admin/analytics/dispatch'))).status).toBe(403)
      mock.auth.mockResolvedValue({ user: { roles: ['admin'] } })
      expect(
        (await handler(request('/api/admin/analytics/dispatch', 'https://evil.example'))).status,
      ).toBe(403)
      expect(mock.dispatch).not.toHaveBeenCalled()
      expect(mock.initialize).not.toHaveBeenCalled()
      expect((await handler(request('/api/admin/analytics/dispatch'))).status).toBe(200)
    },
  )
  it('rejects cross-origin revocations before reading capabilities or connecting', async () => {
    expect((await revoke(request('/api/analytics/revoke', 'https://evil.example'))).status).toBe(
      403,
    )
    expect(mock.getPayload).not.toHaveBeenCalled()
  })
  it('bounds preference bodies and applies rate limits before revocation', async () => {
    const response = await revoke(
      new Request('https://store.example/api/analytics/revoke', {
        method: 'POST',
        headers: { Origin: 'https://store.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'a'.repeat(64) }),
      }),
    )
    expect(response.status).toBe(200)
    expect(mock.limit).toHaveBeenCalled()
    expect(mock.revoke).toHaveBeenCalledWith(expect.anything(), 'a'.repeat(64))
  })
})
