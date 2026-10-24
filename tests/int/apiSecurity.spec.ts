// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  update: vi.fn(),
  findGlobal: vi.fn(),
  updateGlobal: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
import { GET as orders } from '@/app/api/admin/orders/route'
import { POST as updateOrder } from '@/app/api/admin/orders/update-status/route'
import { GET as dashboard } from '@/app/api/admin/dashboard-stats/route'
import { GET as inventory } from '@/app/api/inventory/route'
import { POST as updateInventory } from '@/app/api/inventory/update/route'
import { GET as sale, POST as updateSale } from '@/app/api/admin/sale-settings/route'
import { readJSON, requestError } from '@/utilities/apiSecurity'

const routes = [
  { name: 'orders', method: 'GET', handler: orders },
  { name: 'dashboard', method: 'GET', handler: dashboard },
  { name: 'inventory', method: 'GET', handler: inventory },
  { name: 'sale', method: 'GET', handler: sale },
  {
    name: 'update orders',
    method: 'POST',
    handler: updateOrder,
    body: {
      orderIds: ['order-1'],
      status: 'shipped',
      trackingUrl: 'https://courier.example/track',
    },
  },
  {
    name: 'update inventory',
    method: 'POST',
    handler: updateInventory,
    body: { updates: [{ productId: 'product-1', variantIndex: 0, stock: 4 }] },
  },
  { name: 'update sale', method: 'POST', handler: updateSale, body: { action: 'end_immediately' } },
]
const request = (method: string, body?: unknown, origin?: string) =>
  new Request('https://store.example/api/test', {
    method,
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue(mock)
  mock.find.mockResolvedValue({ docs: [], totalDocs: 0 })
  mock.findByID.mockResolvedValue({ id: 'product-1', variants: [{ stock: 1, size: 'M' }] })
  mock.update.mockResolvedValue({ id: 'order-1' })
  mock.findGlobal.mockResolvedValue({ isActive: false })
  mock.updateGlobal.mockResolvedValue({ isActive: false })
})
describe('Custom admin API boundaries', () => {
  for (const route of routes) {
    for (const user of [null, { id: 'customer', roles: ['customer'] }]) {
      it(`${route.name} denies ${user ? 'customers' : 'guests'} before sensitive reads/writes`, async () => {
        mock.auth.mockResolvedValue({ user })
        const result = await route.handler(request(route.method, route.body))
        expect(result.status).toBe(user ? 403 : 401)
        expect(result.headers.get('cache-control')).toBe('private, no-store')
        for (const operation of [
          mock.find,
          mock.findByID,
          mock.update,
          mock.findGlobal,
          mock.updateGlobal,
        ])
          expect(operation).not.toHaveBeenCalled()
      })
    }
    it(`${route.name} allows an admin and enforces Payload permissions on each operation`, async () => {
      const user = { id: 'admin', roles: ['admin'] }
      mock.auth.mockResolvedValue({ user })
      const result = await route.handler(request(route.method, route.body, 'https://store.example'))
      expect(result.status).toBe(200)
      expect(result.headers.get('cache-control')).toBe('private, no-store')
      const calls = [
        mock.find,
        mock.findByID,
        mock.update,
        mock.findGlobal,
        mock.updateGlobal,
      ].flatMap((operation) => operation.mock.calls)
      expect(calls.length).toBeGreaterThan(0)
      for (const [options] of calls) expect(options).toMatchObject({ user, overrideAccess: false })
    })
  }
  it('rejects cross-origin admin writes even with a valid login', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'admin', roles: ['admin'] } })
    expect(
      (await updateSale(request('POST', { action: 'end_immediately' }, 'https://attacker.example')))
        .status,
    ).toBe(403)
    expect(mock.updateGlobal).not.toHaveBeenCalled()
  })
  it('rejects invalid and oversized update batches before mutations', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'admin', roles: ['admin'] } })
    for (const stock of [-1, 0.5, '4']) {
      expect(
        (await updateInventory(request('POST', { productId: 'product-1', variantIndex: 0, stock })))
          .status,
      ).toBe(400)
    }
    expect(
      (await updateOrder(request('POST', { orderIds: Array(101).fill('a'), status: 'confirmed' })))
        .status,
    ).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })
  it('does not leak database/provider errors', async () => {
    const result = requestError(new Error('secret connection string / private customer data'))
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('secret')
  })
})

describe('Bounded JSON intake', () => {
  it('rejects oversized bodies even without Content-Length', async () => {
    await expect(readJSON(request('POST', { value: 'x'.repeat(100) }), 50)).rejects.toMatchObject({
      status: 413,
    })
  })
  it('rejects non-object JSON, malformed JSON and unsupported content types', async () => {
    for (const body of ['[]', 'null', '{']) {
      await expect(
        readJSON(
          new Request('https://store.example', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          }),
        ),
      ).rejects.toMatchObject({ status: 400 })
    }
    await expect(
      readJSON(new Request('https://store.example', { method: 'POST', body: '{}' })),
    ).rejects.toMatchObject({ status: 415 })
  })
})
