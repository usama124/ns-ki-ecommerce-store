// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ request: vi.fn(), refs: vi.fn(), ready: vi.fn(), transaction: vi.fn(), session: {}, money: vi.fn(), read: vi.fn(), replace: vi.fn(), update: vi.fn(), fence: vi.fn() }))
vi.mock('@/utilities/instaworldClient', async original => ({ ...await original<typeof import('@/utilities/instaworldClient')>(), instaRequest: mock.request, instaReferences: mock.refs }))
vi.mock('@/utilities/commerceDatabase', () => ({ COMMERCE: { config: 'private-config' }, commerceSession: async () => mock.session, commerceTransaction: mock.transaction, requireCommerceReady: mock.ready, mongoCommerce: () => ({ db }) }))
import { bookingBody, bookInstaOrder, guardInstaOrder, instaOrderTracking } from '@/utilities/instaworld'
import type { Payload } from 'payload'
import type { Order as StoreOrder, User } from '@/payload-types'
let row: Record<string, any> | null
const records = { findOne: mock.read, replaceOne: mock.replace, updateOne: mock.update }
const db = { collection: (name: string) => name === 'private-config' ? records : { findOne: mock.money } }
const payload = { findByID: vi.fn(), db: { name: 'mongoose' } } as unknown as Payload
const user = { id: 1, roles: ['admin'] } as User
const references = { locations: [{ id: 812, name: 'Warehouse', city: 'LAHORE' }], cities: ['LAHORE', 'KARACHI'] }
const input = { locationId: 812, city: 'LAHORE', weightsKg: [0.5] }
const order = () => ({ id: 1, orderNumber: '#NKI-123456', status: 'processing', paymentMethod: 'cod', customer: { name: 'QA', phone: '03001234567', city: 'Lahore', province: 'Punjab', address: 'QA street' }, items: [{ product: 1, variantSize: 'M', variantSku: 'QA-M', quantity: 2, unitPrice: 1000 }], subtotal: 2000, shippingFee: 250, codFee: 0, totalAmount: 2250 }) as StoreOrder
const shipment = () => ({ tracking_number: 'IW123', ref_no: '#NKI-123456', location_id: 812, payment: { type: 'cod', amount: 2250 }, consignee: { city: 'LAHORE', phone: '+923001234567', address: 'QA street' }, status: { code: 'BOOKED' }, status_recorded_at: '2026-11-11T12:00:00+05:00' })
beforeEach(() => {
  vi.resetAllMocks(); row = null
  vi.stubEnv('INSTAWORLD_API_KEY', 'iw_test_only')
  mock.read.mockImplementation(async () => row ? structuredClone(row) : null)
  mock.replace.mockImplementation(async (_filter, doc) => { row = structuredClone(doc); return { matchedCount: 1 } })
  mock.update.mockImplementation(async (_filter, operation) => {
    if (row) { Object.assign(row, operation.$set); for (const key of Object.keys(operation.$unset || {})) delete row[key] }
    return { modifiedCount: 1 }
  })
  mock.money.mockResolvedValue(null)
  mock.fence.mockResolvedValue({ matchedCount: 1 })
  mock.ready.mockResolvedValue({ db, adapter: { collections: { orders: { schema: { path: () => ({ cast: (id: unknown) => id }) }, collection: { updateOne: mock.fence } } } } })
  mock.transaction.mockImplementation(async (_payload, _user, work) => work({ payload, user, transactionID: 'txn' }))
  vi.mocked(payload.findByID).mockResolvedValue(order())
  mock.refs.mockResolvedValue(references)
  mock.request.mockImplementation(async path => path.startsWith('/shipments?') ? [] : path.endsWith('/events') ? [] : shipment())
})
afterEach(() => vi.unstubAllEnvs())
describe('InstaWorld COD booking validation', () => {
  it('uses persisted COD totals, item prices and quantities, not browser totals', () => {
    expect(bookingBody(order(), { ...input, totalAmount: 1 }, references)).toMatchObject({ payment: { type: 'cod', amount: 2250 }, location_id: 812, items: [{ quantity: 2, price: 1000, kg: 0.5 }], open_parcel_feature: false })
  })
  it.each(['confirmed', 'shipped', 'delivered', 'cancelled', 'pending_verification'])('rejects booking outside Processing: %s', status => {
    expect(() => bookingBody({ ...order(), status } as StoreOrder, input, references)).toThrow('Processing COD')
  })
  it('rejects prepaid, unowned pickup, different destination, long addresses, missing weights and existing tracking', () => {
    expect(() => bookingBody({ ...order(), paymentMethod: 'bank_transfer' }, input, references)).toThrow()
    for (const bad of [{ ...input, locationId: 99 }, { ...input, city: 'KARACHI' }, { ...input, weightsKg: [] }, { ...input, weightsKg: [0] }, { ...input, weightsKg: [NaN] }]) expect(() => bookingBody(order(), bad, references)).toThrow()
    expect(() => bookingBody({ ...order(), customer: { ...order().customer, address: 'x'.repeat(201) } }, input, references)).toThrow('200')
    expect(() => bookingBody({ ...order(), fulfillment: { trackingNumber: 'MANUAL' } }, input, references)).toThrow('already')
  })
})
describe('durable booking and reconciliation', () => {
  it('requires an admin and configured credentials before calling the provider', async () => {
    await expect(bookInstaOrder(payload, { roles: ['customer'] } as User, 1, input)).rejects.toMatchObject({ status: 403 })
    vi.stubEnv('INSTAWORLD_API_KEY', '')
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toMatchObject({ status: 503 })
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('claims an immutable request, fences the order, books once and replays locally', async () => {
    expect(await bookInstaOrder(payload, user, 1, input)).toMatchObject({ trackingNumber: 'IW123', status: 'BOOKED' })
    expect(mock.fence).toHaveBeenCalledTimes(2)
    const create = mock.request.mock.calls.find(([path]) => path === '/shipments')!
    expect(create[1]).toMatchObject({ payment: { amount: 2250 } })
    expect(create[2]).toMatch(/^nski-1-/)
    expect(row!.state).toBe('booked')
    await bookInstaOrder(payload, user, 1, { ...input, weightsKg: [99] })
    expect(mock.request.mock.calls.filter(([path]) => path === '/shipments')).toHaveLength(1)
  })
  it('retains an uncertain attempt and reconciles the existing consignment without rebooking', async () => {
    mock.request.mockImplementation(async path => { if (path.startsWith('/shipments?')) return []; throw new Error('timeout') })
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toMatchObject({ status: 503 })
    const key = row!.key
    expect(row!.state).toBe('uncertain')
    mock.request.mockImplementation(async path => path.startsWith('/shipments?') ? [shipment()] : shipment())
    await bookInstaOrder(payload, user, 1, input)
    expect(row!.key).toBe(key)
    expect(row!.state).toBe('booked')
    expect(mock.request.mock.calls.filter(([path]) => path === '/shipments')).toHaveLength(1)
  })
  it('never blindly resends after the safe idempotency window expires', async () => {
    mock.request.mockImplementation(async path => { if (path.startsWith('/shipments?')) return []; throw new Error('timeout') })
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toThrow()
    row!.startedAt = new Date(Date.now() - 24 * 3600000)
    mock.request.mockClear()
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toMatchObject({ status: 409 })
    expect(mock.request.mock.calls.some(([path]) => path === '/shipments')).toBe(false)
  })
  it('blocks concurrent claims, key changes, partial payment and mismatched upstream shipments', async () => {
    mock.money.mockResolvedValue({ _id: 'paid' })
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toThrow('recorded money')
    mock.money.mockResolvedValue(null)
    mock.request.mockImplementation(async path => { if (path.startsWith('/shipments?')) return []; throw new Error('timeout') })
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toThrow()
    row!.leaseUntil = new Date(Date.now() + 60000)
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toMatchObject({ status: 409 })
    row!.leaseUntil = new Date(0)
    vi.stubEnv('INSTAWORLD_API_KEY', 'other-key')
    await expect(bookInstaOrder(payload, user, 1, input)).rejects.toThrow('credential changed')
  })
})
describe('tracking and stock-safe order guards', () => {
  it('refreshes courier history without mutating order status, inventory or payments', async () => {
    await bookInstaOrder(payload, user, 1, input)
    row!.tracking.checkedAt = new Date(0).toISOString()
    mock.request.mockImplementation(async path => path.endsWith('/events') ? [{ status: 'DELIVERY_ATTEMPT_FAILED', recorded_at: '2026-11-11T13:00:00+05:00', secret: 'private' }] : { ...shipment(), status: { code: 'DELIVERY_ATTEMPT_FAILED' }, status_recorded_at: '2026-11-11T13:00:00+05:00' })
    expect(await instaOrderTracking(payload, 1, true)).toMatchObject({ status: 'DELIVERY_ATTEMPT_FAILED', events: [{ status: 'DELIVERY_ATTEMPT_FAILED', recordedAt: '2026-11-11T08:00:00.000Z' }] })
    expect(payload).not.toHaveProperty('update')
    mock.request.mockClear()
    await instaOrderTracking(payload, 1, true)
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('retains cached tracking when provider calls fail', async () => {
    await bookInstaOrder(payload, user, 1, input)
    row!.tracking.checkedAt = new Date(0).toISOString()
    mock.request.mockRejectedValue(new Error('offline'))
    expect(await instaOrderTracking(payload, 1, true)).toMatchObject({ trackingNumber: 'IW123', status: 'BOOKED' })
    mock.request.mockClear()
    await instaOrderTracking(payload, 1, true)
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('guards cancellation, deletion and edits across generic Payload mutations', async () => {
    await bookInstaOrder(payload, user, 1, input)
    const req = { payload, transactionID: 'txn' } as never
    await expect(guardInstaOrder(order(), { status: 'cancelled' }, req)).rejects.toMatchObject({ status: 409 })
    await expect(guardInstaOrder(order(), null, req)).rejects.toThrow()
    await expect(guardInstaOrder(order(), { shippingFee: 1 }, req)).rejects.toThrow()
    await expect(guardInstaOrder(order(), { status: 'shipped' }, req)).resolves.toBeUndefined()
  })
})
