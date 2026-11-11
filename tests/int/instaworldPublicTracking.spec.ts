// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ getPayload: vi.fn(), find: vi.fn(), track: vi.fn(), limit: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/instaworld', () => ({ instaOrderTracking: mock.track }))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: mock.limit }))
import { GET } from '@/app/api/orders/track/route'
const request = () => new Request('https://store.example/api/orders/track?orderNumber=123456&contact=03001234567')
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ db: { name: 'mongoose' }, find: mock.find })
  mock.find.mockResolvedValue({ docs: [{ id: 1, orderNumber: '#NKI-123456', status: 'processing', createdAt: '2026-11-11T00:00:00Z', customer: { phone: 'PRIVATE' }, notes: 'PRIVATE' }] })
  mock.track.mockResolvedValue({ trackingNumber: 'IW123', status: 'IN_TRANSIT', checkedAt: '2026-11-11T01:00:00Z', statusRecordedAt: null, events: [] })
})
describe('customer courier tracking access', () => {
  it('calls courier tracking only after exact contact lookup and rate-limit checks', async () => {
    mock.track.mockImplementation(async () => {
      expect(mock.limit).toHaveBeenCalledOnce(); expect(mock.find).toHaveBeenCalledOnce()
      return { trackingNumber: 'IW123', status: 'BOOKED', events: [] }
    })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ order: { shipping: { trackingNumber: 'IW123', status: 'BOOKED' } } })
    expect(mock.track).toHaveBeenCalledWith(expect.anything(), 1, true)
  })
  it('does not expose a tracking-number lookup before the order/contact combination matches', async () => {
    mock.find.mockResolvedValue({ docs: [] })
    expect((await GET(request())).status).toBe(404)
    expect(mock.track).not.toHaveBeenCalled()
  })
  it('returns no customer contact, payment or raw booking data', async () => {
    const response = await GET(request())
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const value = await response.text()
    expect(value).not.toMatch(/PRIVATE|consignee|credential|location_key|paymentProof/)
    expect(value).toContain('IN_TRANSIT')
  })
  it('keeps the basic order status available if the courier snapshot cannot be loaded', async () => {
    mock.track.mockRejectedValue(new Error('private storage unavailable'))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ order: { status: 'processing' } })
  })
})
