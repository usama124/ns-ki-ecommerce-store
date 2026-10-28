// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  dispatch: vi.fn(),
  limit: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/orderOutbox', () => ({ dispatchOrderEmails: mock.dispatch }))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: mock.limit }))
import { GET, POST } from '@/app/api/admin/commerce/dispatch/route'
import { Users } from '@/collections/Users'
import { RequestError } from '@/utilities/apiSecurity'

beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: mock.auth })
  mock.dispatch.mockResolvedValue({ sent: 1, retried: 0, dead: 0 })
})
afterEach(() => vi.unstubAllEnvs())
describe('email worker access', () => {
  it('fails closed for missing, short or incorrect worker secrets before loading Payload', async () => {
    for (const secret of ['', 'too-short', 'x'.repeat(32)]) {
      vi.stubEnv('COMMERCE_WORKER_SECRET', secret)
      const response = await GET(
        new Request('https://store.example/api/admin/commerce/dispatch', {
          headers: { Authorization: 'Bearer wrong' },
        }),
      )
      expect(response.status).toBe(403)
    }
    expect(mock.getPayload).not.toHaveBeenCalled()
    expect(mock.dispatch).not.toHaveBeenCalled()
  })
  it('accepts only the correct scheduler bearer and returns private aggregate results', async () => {
    vi.stubEnv('COMMERCE_WORKER_SECRET', 'x'.repeat(32))
    const response = await GET(
      new Request('https://store.example/api/admin/commerce/dispatch', {
        headers: { Authorization: `Bearer ${'x'.repeat(32)}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ sent: 1, retried: 0, dead: 0 })
  })
  it('manual dispatch requires an admin and a same-origin request', async () => {
    mock.auth.mockResolvedValue({ user: { id: 1, roles: ['customer'] } })
    const request = (origin = 'https://store.example') =>
      new Request('https://store.example/api/admin/commerce/dispatch', {
        method: 'POST',
        headers: { Origin: origin },
      })
    expect((await POST(request())).status).toBe(403)
    mock.auth.mockResolvedValue({ user: { id: 1, roles: ['admin'] } })
    expect((await POST(request('https://evil.example'))).status).toBe(403)
    expect(mock.dispatch).not.toHaveBeenCalled()
    expect((await POST(request())).status).toBe(200)
  })
})
describe('generic account endpoint abuse controls', () => {
  const hook = Users.hooks!.beforeOperation![0]
  it.each(['REST', 'GraphQL'])(
    'limits %s registration and password recovery before mutation',
    async (payloadAPI) => {
      for (const operation of ['create', 'forgotPassword']) {
        mock.limit.mockRejectedValue(new RequestError('Too many attempts', 429))
        await expect(
          hook({
            operation,
            args: { data: { email: 'customer@example.invalid' } },
            req: { payloadAPI, payload: {}, headers: new Headers() },
          } as never),
        ).rejects.toMatchObject({ status: 429 })
      }
    },
  )
  it('leaves authenticated admin/local provisioning paths under their existing permissions', async () => {
    for (const req of [
      { payloadAPI: 'local' },
      { payloadAPI: 'REST', user: { roles: ['admin'] } },
    ]) {
      const args = { data: { email: 'admin@example.invalid' } }
      expect(await hook({ operation: 'create', args, req } as never)).toBe(args)
    }
    expect(mock.limit).not.toHaveBeenCalled()
  })
})
