import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { randomUUID } from 'node:crypto'

// No .env, remote host, dynamic database name or production service is accepted.
const URL =
  'mongodb://127.0.0.1:27029/nski_commerce_test_20261024?replicaSet=nski-test&directConnection=true'
let payload: Payload
let category: number
let size: number
let admin: User
let commerce: typeof import('@/utilities/commerceDatabase')
let checkout: typeof import('@/utilities/checkoutCommand')
let parse: typeof import('@/utilities/checkoutQuote')
let limits: typeof import('@/utilities/requestLimits')

describe.skipIf(process.env.RUN_COMMERCE_DB_TESTS !== '1')(
  'real MongoDB replica-set purchase integrity',
  () => {
    beforeAll(async () => {
      for (const name of ['MONGODB_URI', 'MONGODB_URL', 'DATABASE_URL']) vi.stubEnv(name, URL)
      vi.stubEnv('DB_ADAPTER', 'mongodb')
      vi.stubEnv('PAYLOAD_SECRET', 'disposable-commerce-tests-only')
      vi.stubEnv('PAYLOAD_DROP_DATABASE', 'false')
      vi.stubEnv('R2_BUCKET', '')
      vi.stubEnv('RESEND_API_KEY', '')
      const { getPayload } = await import('payload')
      const { default: config } = await import('@/payload.config')
      const sanitized = await config
      sanitized.typescript.autoGenerate = false
      payload = await getPayload({ config: sanitized })
      commerce = await import('@/utilities/commerceDatabase')
      const { db } = commerce.mongoCommerce(payload)
      if (db.databaseName !== 'nski_commerce_test_20261024') throw new Error('Unsafe test database')
      // Only this explicitly named disposable database is cleaned.
      for (const collection of await db.collections()) await collection.deleteMany({})
      await commerce.initializeCommerce(payload)
      const cat = await payload.create({
        collection: 'categories',
        data: { name: 'Test', type: 'main', slug: 'test' },
        context: { disableRevalidate: true },
      })
      category = cat.id
      size = (await payload.create({ collection: 'sizes', data: { name: 'M' } })).id
      admin = await payload.create({
        collection: 'users',
        data: {
          email: 'admin@example.invalid',
          password: 'synthetic-test-password-only',
          roles: ['admin'],
        },
      })
      await payload.updateGlobal({
        slug: 'site-settings',
        data: {
          shipping: {
            majorCityFee: 250,
            secondaryCityFee: 350,
            freeShippingThreshold: 15000,
            codFee: 100,
          },
          paymentDetails: {
            jazzcash: { accountName: 'Test merchant', mobileNumber: '03001112222' },
          },
        },
        context: { disableRevalidate: true },
      })
      await payload.updateGlobal({
        slug: 'sale-settings',
        data: { isActive: false },
        context: { disableRevalidate: true },
      })
      checkout = await import('@/utilities/checkoutCommand')
      parse = await import('@/utilities/checkoutQuote')
      limits = await import('@/utilities/requestLimits')
    })
    beforeEach(async () => {
      const { db, adapter } = commerce.mongoCommerce(payload)
      for (const slug of ['orders', 'products']) await adapter.collections[slug].deleteMany({})
      for (const name of [
        commerce.COMMERCE.checkout,
        commerce.COMMERCE.movements,
        commerce.COMMERCE.outbox,
        commerce.COMMERCE.limits,
      ])
        await db.collection(name).deleteMany({})
    })
    afterAll(async () => {
      if (payload) await payload.destroy()
      vi.unstubAllEnvs()
    })
    afterEach(() => vi.unstubAllGlobals())
    const product = (stock = 1, allowBackorder = false) =>
      payload.create({
        collection: 'products',
        data: {
          title: 'Test suit',
          slug: randomUUID(),
          status: 'published',
          primaryCategory: category,
          categories: [category],
          basePricePKR: 1000,
          variants: [{ size, stock, allowBackorder }],
        },
        context: { skipShoppableVideoSync: true },
      })
    const input = (id: number, quantity = 1) =>
      parse.parseCheckout({
        customer: {
          name: 'Test Buyer',
          phone: '03001112222',
          email: 'test@example.invalid',
          city: 'Lahore',
          province: 'Punjab',
          address: 'Synthetic test address',
        },
        items: [{ productId: String(id), variantSize: 'M', quantity }],
        paymentMethod: 'cod',
      })
    const purchase = (
      data: ReturnType<typeof input>,
      key = checkout.checkoutKey(randomUUID()),
      amount = 1350,
    ) => checkout.executeCheckout(payload, data, amount, key)
    const stock = async (id: number) =>
      (await payload.findByID({ collection: 'products', id, depth: 0 })).variants![0].stock
    const status = (id: number | string, next: 'cancelled' | 'confirmed') =>
      commerce.commerceTransaction(payload, null, (req) =>
        payload.update({ collection: 'orders', id, data: { status: next }, req }),
      )

    it('allows exactly one of two different checkouts for the last unit', async () => {
      const item = await product(1)
      const results = await Promise.allSettled([purchase(input(item.id)), purchase(input(item.id))])
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(await stock(item.id)).toBe(0)
      expect((await payload.count({ collection: 'orders' })).totalDocs).toBe(1)
    })
    it('concurrent retries return one order and deduct stock only once', async () => {
      const item = await product(10)
      const key = checkout.checkoutKey(randomUUID())
      const results = await Promise.all([
        purchase(input(item.id), key),
        purchase(input(item.id), key),
        purchase(input(item.id), key),
      ])
      expect(
        new Set(results.map((result) => ('orderId' in result ? result.orderId : null))).size,
      ).toBe(1)
      expect(await stock(item.id)).toBe(9)
      expect((await payload.count({ collection: 'orders' })).totalDocs).toBe(1)
      const { db } = commerce.mongoCommerce(payload)
      expect(await db.collection(commerce.COMMERCE.outbox).countDocuments()).toBe(2)
      expect(await db.collection(commerce.COMMERCE.movements).countDocuments()).toBe(1)
    })
    it('recovers a completed checkout after its HTTP response was lost', async () => {
      const item = await product(2)
      const key = checkout.checkoutKey(randomUUID())
      const first = await purchase(input(item.id), key)
      const retry = await purchase(input(item.id), key)
      expect(retry).toMatchObject({ ...first, replayed: true })
      expect(await stock(item.id)).toBe(1)
      await expect(purchase(input(item.id, 2), key, 2350)).rejects.toThrow('different details')
    })
    it('rolls back stock/order/outbox/claim together if a later write fails', async () => {
      const item = await product(2)
      const original = payload.create.bind(payload)
      const spy = vi.spyOn(payload, 'create').mockImplementation(async (args) => {
        const result = await original(args as never)
        if (args.collection === 'orders') throw new Error('simulated failure after order hooks')
        return result
      })
      try {
        await expect(purchase(input(item.id))).rejects.toThrow('simulated failure')
      } finally {
        spy.mockRestore()
      }
      expect(await stock(item.id)).toBe(2)
      expect((await payload.count({ collection: 'orders' })).totalDocs).toBe(0)
      const { db } = commerce.mongoCommerce(payload)
      for (const name of [
        commerce.COMMERCE.checkout,
        commerce.COMMERCE.movements,
        commerce.COMMERCE.outbox,
      ])
        expect(await db.collection(name).countDocuments()).toBe(0)
    })
    it('does not reserve stock or claim the key for an unconfirmed changed quote', async () => {
      const item = await product(1)
      const key = checkout.checkoutKey(randomUUID())
      expect(await purchase(input(item.id), key, 1)).toMatchObject({ quote: { totalAmount: 1350 } })
      expect(await stock(item.id)).toBe(1)
      expect(await purchase(input(item.id), key)).toHaveProperty('orderId')
    })
    it('cancel/repeat-cancel/reactivate preserve stock and do not over-restore backorders', async () => {
      const item = await product(1, true)
      const result = await purchase(input(item.id, 3), undefined, 3350)
      if (!('orderId' in result)) throw new Error('missing order')
      expect(await stock(item.id)).toBe(0)
      await status(result.orderId, 'cancelled')
      expect(await stock(item.id)).toBe(1)
      await status(result.orderId, 'cancelled')
      expect(await stock(item.id)).toBe(1)
      await status(result.orderId, 'confirmed')
      expect(await stock(item.id)).toBe(0)
      await status(result.orderId, 'cancelled')
      expect(await stock(item.id)).toBe(1)
    })
    it('active item edits reconcile the old allocation and new quantity atomically', async () => {
      const item = await product(5)
      const result = await purchase(input(item.id))
      if (!('orderId' in result)) throw new Error('missing order')
      await commerce.commerceTransaction(payload, null, (req) =>
        payload.update({
          collection: 'orders',
          id: result.orderId,
          data: { items: [{ product: item.id, variantSize: 'M', quantity: 3, unitPrice: 1000 }] },
          req,
        }),
      )
      expect(await stock(item.id)).toBe(2)
      await status(result.orderId, 'cancelled')
      expect(await stock(item.id)).toBe(5)
    })
    it('distributed counters reject excess attempts atomically without storing raw contacts', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          limits.enforceRequestLimit(payload, new Headers(), 'recovery', 'test@example.invalid'),
        ),
      )
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5)
      const docs = await commerce
        .mongoCommerce(payload)
        .db.collection(commerce.COMMERCE.limits)
        .find()
        .toArray()
      expect(JSON.stringify(docs)).not.toContain('test@example.invalid')
    })
    it('concurrent admin cancellation with enforced access restores stock once and persists system allocations', async () => {
      const item = await product(2)
      const result = await purchase(input(item.id))
      if (!('orderId' in result)) throw new Error('missing order')
      await Promise.all(
        [1, 2].map(() =>
          commerce.commerceTransaction(payload, admin, (req) =>
            payload.update({
              collection: 'orders',
              id: result.orderId,
              user: admin,
              overrideAccess: false,
              data: { status: 'cancelled' },
              req,
            }),
          ),
        ),
      )
      expect(await stock(item.id)).toBe(2)
      const order = await payload.findByID({ collection: 'orders', id: result.orderId })
      expect(order.inventoryState).toMatchObject({ version: 1, active: false, sequence: 2 })
    })
    it('active order deletion and reserved variant removal are refused', async () => {
      const item = await product(2)
      const result = await purchase(input(item.id))
      if (!('orderId' in result)) throw new Error('missing order')
      await expect(payload.delete({ collection: 'orders', id: result.orderId })).rejects.toThrow(
        'Cancel and reconcile',
      )
      await expect(
        payload.update({ collection: 'products', id: item.id, data: { variants: [] } }),
      ).rejects.toThrow('active orders')
      await expect(payload.delete({ collection: 'products', id: item.id })).rejects.toThrow(
        'active orders',
      )
      expect(await stock(item.id)).toBe(1)
    })
    it('a stale admin product form cannot overwrite stock after checkout', async () => {
      const item = await product(5)
      await purchase(input(item.id))
      await payload.update({
        collection: 'products',
        id: item.id,
        user: admin,
        overrideAccess: false,
        data: { title: 'Edited after sale', variants: item.variants },
        context: { skipShoppableVideoSync: true },
      })
      expect(await stock(item.id)).toBe(4)
    })
    it('legacy cancellation fails closed without inventing old backorder allocations', async () => {
      const item = await product(2)
      const result = await purchase(input(item.id))
      if (!('orderId' in result)) throw new Error('missing order')
      const { adapter } = commerce.mongoCommerce(payload)
      await adapter.collections.orders.updateOne(
        { _id: result.orderId },
        { $unset: { inventoryState: '' } },
      )
      await expect(status(result.orderId, 'cancelled')).rejects.toThrow(
        'legacy order needs stock reconciliation',
      )
      expect(await stock(item.id)).toBe(1)
    })
    it('two email workers lease separate jobs and record provider acceptance', async () => {
      const item = await product(2)
      await purchase(input(item.id))
      vi.stubEnv('RESEND_API_KEY', 'test-only-no-provider')
      vi.stubEnv('FROM_EMAIL', 'orders@example.invalid')
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.invalid')
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'provider-test-id' }), { status: 200 }),
        )
      // Each response body must be independently consumable.
      fetch.mockImplementation(
        async () => new Response(JSON.stringify({ id: 'provider-test-id' }), { status: 200 }),
      )
      vi.stubGlobal('fetch', fetch)
      const { dispatchOrderEmails } = await import('@/utilities/orderOutbox')
      await Promise.all([dispatchOrderEmails(payload), dispatchOrderEmails(payload)])
      expect(fetch).toHaveBeenCalledTimes(2)
      const keys = fetch.mock.calls
        .map((call: unknown[]) => (call[1] as RequestInit).headers as Record<string, string>)
        .map((headers) => headers['Idempotency-Key'])
      expect(new Set(keys).size).toBe(2)
      expect(
        await commerce
          .mongoCommerce(payload)
          .db.collection(commerce.COMMERCE.outbox)
          .countDocuments({ state: 'sent' }),
      ).toBe(2)
    })
    it('failed email sends persist for retry; old ambiguous sends go to manual review', async () => {
      const item = await product(2)
      await purchase(input(item.id))
      vi.stubEnv('RESEND_API_KEY', 'test-only-no-provider')
      vi.stubEnv('FROM_EMAIL', 'orders@example.invalid')
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.invalid')
      const fetch = vi.fn().mockRejectedValue(new Error('simulated timeout'))
      vi.stubGlobal('fetch', fetch)
      const { dispatchOrderEmails } = await import('@/utilities/orderOutbox')
      expect(await dispatchOrderEmails(payload)).toMatchObject({ retried: 2 })
      const jobs = commerce.mongoCommerce(payload).db.collection(commerce.COMMERCE.outbox)
      expect(await jobs.countDocuments({ state: 'pending', attempts: 1 })).toBe(2)
      const saved = await jobs.find().toArray()
      expect(saved.every((job) => job.delivery && !job.lease)).toBe(true)
      await jobs.updateMany(
        {},
        { $set: { availableAt: new Date(0), firstAttemptAt: new Date(Date.now() - 25 * 3600000) } },
      )
      expect(await dispatchOrderEmails(payload)).toMatchObject({ dead: 2 })
      expect(fetch).toHaveBeenCalledTimes(2)
    })
    it('internal notes never become a customer cancellation email reason', async () => {
      const item = await product(2)
      const result = await purchase(input(item.id))
      if (!('orderId' in result)) throw new Error('missing order')
      await commerce.commerceTransaction(payload, null, (req) =>
        payload.update({
          collection: 'orders',
          id: result.orderId,
          data: { status: 'cancelled', notes: 'INTERNAL-ONLY-FRAUD-REVIEW' },
          req,
        }),
      )
      const job = await commerce
        .mongoCommerce(payload)
        .db.collection(commerce.COMMERCE.outbox)
        .findOne({ kind: 'cancelled' })
      expect(job?.html).not.toContain('INTERNAL-ONLY-FRAUD-REVIEW')
    })
  },
)
