// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instaReferences, instaRequest, safeEvents, safeShipment } from '@/utilities/instaworldClient'
beforeEach(() => { vi.stubEnv('INSTAWORLD_API_KEY', 'iw_test_secret'); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('InstaWorld HTTP boundary', () => {
  it('uses only the fixed HTTPS origin, server header, timeout and no redirects', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"ok":true}}'))
    await instaRequest('/shipments', { ref_no: '#TEST' }, 'idempotent-key')
    expect(fetch).toHaveBeenCalledWith('https://one-be.instaworld.pk/merchant-api/v2/shipments', expect.objectContaining({ method: 'POST', redirect: 'error', cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer iw_test_secret', 'Idempotency-Key': 'idempotent-key' }) }))
  })
  it('fails closed without a key', async () => {
    vi.stubEnv('INSTAWORLD_API_KEY', '')
    await expect(instaRequest('/cities')).rejects.toMatchObject({ status: 503 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('never returns upstream private error messages', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"error":{"code":"invalid_phone","message":"secret-key customer-phone"}}', { status: 422 }))
    await expect(instaRequest('/shipments', {})).rejects.toMatchObject({ code: 'invalid_phone', upstreamStatus: 422, message: expect.not.stringContaining('secret-key') })
  })
  it('rejects malformed or oversized responses', async () => {
    for (const body of ['html', '{}', 'x'.repeat(2 * 1024 * 1024 + 1)]) {
      vi.mocked(fetch).mockResolvedValue(new Response(body))
      await expect(instaRequest('/cities')).rejects.toThrow()
    }
  })
  it('strips legacy location credentials and inactive/unowned reference fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 1, name: 'Pickup', city: 'LAHORE', is_active: true, location_key: 'NEVER_EXPOSE' }, { id: 2, name: 'Inactive', is_active: false }] })))
      .mockResolvedValueOnce(new Response('{"data":[{"name":"LAHORE","private":"secret"}]}'))
    expect(await instaReferences()).toEqual({ locations: [{ id: 1, name: 'Pickup', city: 'LAHORE' }], cities: ['LAHORE'] })
  })
  it('validates shipment reference and tracking identity and exposes no consignee details', () => {
    const data = { tracking_number: 'IW-1', ref_no: '#TEST', status: { code: 'BOOKED' }, consignee: { phone: 'private' } }
    const safe = safeShipment(data, '#TEST')
    expect(safe).not.toHaveProperty('consignee')
    expect(() => safeShipment(data, '#OTHER')).toThrow()
    expect(() => safeShipment(data, '#TEST', 'DIFFERENT')).toThrow()
    expect(safeEvents([{ status: 'IN_TRANSIT', recorded_at: 'bad-date', phone: 'private' }])).toEqual([{ status: 'IN_TRANSIT', recordedAt: null }])
  })
})
