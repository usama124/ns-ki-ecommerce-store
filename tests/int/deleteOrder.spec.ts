// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ getPayload: vi.fn(), auth: vi.fn(), find: vi.fn(), remove: vi.fn(), transaction: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/commerceDatabase', () => ({ commerceTransaction: mock.transaction }))
import { POST } from '@/app/api/admin/orders/delete/route'
import { RequestError } from '@/utilities/apiSecurity'
const user = { id: 'admin-1', roles: ['admin'] }
const payload = { auth: mock.auth, findByID: mock.find, delete: mock.remove }
const req = { transactionID: 'test-session', user }
const request = (body: unknown = { orderId: 'order-1', orderNumber: '#NKI-123456' }, origin = 'https://store.example') => new Request('https://store.example/api/admin/orders/delete', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue(payload)
  mock.auth.mockResolvedValue({ user })
  mock.find.mockResolvedValue({ id: 'order-1', orderNumber: '#NKI-123456', status: 'cancelled' })
  mock.transaction.mockImplementation(async (_payload, _user, work) => work(req))
})
afterEach(() => vi.unstubAllEnvs())
describe('admin order deletion', () => {
  it.each([null, { id: 'customer-1', roles: ['customer'] }, { id: 'staff-1', roles: ['editor'] }])('rejects non-admin user %j before mutation', async user => {
    mock.auth.mockResolvedValue({ user })
    expect((await POST(request())).status).toBe(user ? 403 : 401)
    expect(mock.transaction).not.toHaveBeenCalled()
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('rejects cross-origin admin requests', async () => {
    expect((await POST(request(undefined, 'https://evil.example'))).status).toBe(403)
    expect(mock.transaction).not.toHaveBeenCalled()
  })
  it.each([{}, { orderId: { $ne: null }, orderNumber: 'x' }, { orderId: 'order-1' }, { orderId: 'order-1', orderNumber: '' }])('rejects invalid selection %j', async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(mock.transaction).not.toHaveBeenCalled()
  })
  it('returns 404 for a missing/already-deleted order', async () => {
    mock.find.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(404)
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('rejects stale or mismatched order confirmation', async () => {
    expect((await POST(request({ orderId: 'order-1', orderNumber: '#NKI-other' }))).status).toBe(409)
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it.each(['pending_verification', 'confirmed', 'processing', 'shipped', 'delivered'])('requires cancellation before deleting %s', async status => {
    mock.find.mockResolvedValue({ orderNumber: '#NKI-123456', status })
    expect((await POST(request())).status).toBe(409)
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('uses access-controlled Payload deletion in the same transaction as the read', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, deletedId: 'order-1' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mock.find).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1', user, overrideAccess: false, req }))
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith({ collection: 'orders', id: 'order-1', user, overrideAccess: false, req })
  })
  it('preserves financial/audit hook errors rather than bypassing them', async () => {
    mock.remove.mockRejectedValue(new RequestError('Orders with recorded money cannot be deleted.', 409))
    const response = await POST(request())
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'Orders with recorded money cannot be deleted.' })
  })
  it('does not report success when the transaction fails', async () => {
    mock.transaction.mockRejectedValue(new Error('private db details'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private db details')
  })
})
