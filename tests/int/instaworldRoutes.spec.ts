// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ auth: vi.fn(), getPayload: vi.fn(), book: vi.fn(), state: vi.fn(), refs: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/instaworld', () => ({ bookInstaOrder: mock.book, instaAdminState: mock.state }))
vi.mock('@/utilities/instaworldClient', () => ({ instaReferences: mock.refs }))
import { POST, GET } from '@/app/api/admin/orders/instaworld/route'
import { GET as references } from '@/app/api/admin/instaworld/references/route'
const request = (body: unknown, origin = 'https://store.example') => new Request('https://store.example/api/admin/orders/instaworld', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ auth: mock.auth })
  mock.auth.mockResolvedValue({ user: { id: 1, roles: ['admin'] } })
  mock.state.mockResolvedValue({ tracking: null, configured: true })
  mock.refs.mockResolvedValue({ cities: [], locations: [] })
})
describe('courier routes admin boundary', () => {
  it.each([null, { roles: ['customer'] }])('blocks non-admin %j from booking, tracking management and references', async user => {
    mock.auth.mockResolvedValue({ user })
    const status = user ? 403 : 401
    expect((await POST(request({ orderId: '1', action: 'book', confirm: true }))).status).toBe(status)
    expect((await GET(new Request('https://store.example/api/admin/orders/instaworld?orderId=1'))).status).toBe(status)
    expect((await references(new Request('https://store.example/api/admin/instaworld/references'))).status).toBe(status)
    expect(mock.book).not.toHaveBeenCalled(); expect(mock.refs).not.toHaveBeenCalled()
  })
  it('requires same-origin, a valid ID and explicit booking confirmation', async () => {
    expect((await POST(request({ orderId: '1', action: 'book', confirm: true }, 'https://evil.example'))).status).toBe(403)
    expect((await POST(request({ orderId: {}, action: 'book', confirm: true }))).status).toBe(400)
    expect((await POST(request({ orderId: '1', action: 'book' }))).status).toBe(400)
    expect(mock.book).not.toHaveBeenCalled()
  })
  it('books only by explicit action and returns private sanitized state', async () => {
    const response = await POST(request({ orderId: '1', action: 'book', confirm: true }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mock.book).toHaveBeenCalledOnce()
    expect(mock.state).toHaveBeenCalledWith(expect.anything(), expect.anything(), '1', false)
  })
  it('refresh never books a shipment', async () => {
    expect((await POST(request({ orderId: '1', action: 'refresh' }))).status).toBe(200)
    expect(mock.book).not.toHaveBeenCalled()
    expect(mock.state).toHaveBeenCalledWith(expect.anything(), expect.anything(), '1', true)
  })
})
