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
    it('aggregates every order beyond the old reporting cap and exposes later pages', async () => {
      const { db, adapter } = commerce.mongoCommerce(payload)
      // Minimal synthetic report fixtures, only in this disposable database.
      await db.collection(adapter.collections.orders.collection.collectionName).insertMany(
        Array.from({ length: 501 }, (_, index) => ({
          orderNumber: `QA-REPORT-${index}`,
          status: index === 500 ? 'cancelled' : 'confirmed',
          totalAmount: 1000,
          createdAt: new Date(1700000000000 + index),
          updatedAt: new Date(),
        })),
      )
      const { getOrderStats } = await import('@/utilities/orderReport')
      expect(await getOrderStats(payload, admin)).toMatchObject({
        totalOrders: 501,
        confirmed: 500,
        cancelled: 1,
        totalRevenue: 500000,
      })
      const page = await payload.find({
        collection: 'orders',
        user: admin,
        overrideAccess: false,
        limit: 50,
        page: 11,
        depth: 0,
        sort: 'createdAt',
      })
      expect(page.totalDocs).toBe(501)
      expect(page.docs).toHaveLength(1)
    })
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
      const edited = await payload.findByID({ collection: 'orders', id: result.orderId, depth: 0 })
      expect(edited.subtotal).toBe(3000)
      expect(edited.totalAmount).toBe(3350)
      await status(result.orderId, 'cancelled')
      expect(await stock(item.id)).toBe(5)
    })
    it('derives required totals before validating an administrator-created order', async () => {
      const item = await product(5)
      const saved = await commerce.commerceTransaction(payload, admin, (req) =>
        payload.create({
          collection: 'orders',
          user: admin,
          overrideAccess: false,
          req,
          data: {
            customer: input(item.id).customer,
            items: [{ product: item.id, variantSize: 'M', quantity: 2, unitPrice: 1000 }],
            shippingFee: 250,
            codFee: 100,
            paymentMethod: 'cod',
          } as never,
        }),
      )
      expect(saved.subtotal).toBe(2000)
      expect(saved.totalAmount).toBe(2350)
      expect(await stock(item.id)).toBe(3)
    })
    it('rejects invalid financial edits without changing order or stock', async () => {
      const item = await product(5)
      const result = await purchase(input(item.id))
      if (!('orderId' in result)) throw new Error('missing order')
      await expect(
        commerce.commerceTransaction(payload, admin, (req) =>
          payload.update({
            collection: 'orders',
            id: result.orderId,
            user: admin,
            overrideAccess: false,
            req,
            data: { items: [{ product: item.id, variantSize: 'M', quantity: 3, unitPrice: -1 }] },
          }),
        ),
      ).rejects.toThrow()
      expect(await stock(item.id)).toBe(4)
      const saved = await payload.findByID({ collection: 'orders', id: result.orderId, depth: 0 })
      expect(saved.totalAmount).toBe(1350)
      expect(saved.items[0].quantity).toBe(1)
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
    describe('consented transactional analytics (all provider traffic mocked)', () => {
      let analytics: typeof import('@/utilities/orderAnalytics')
      const attribution = {
        consent: 'granted',
        clientId: '123456.789012',
        sessionId: String(Math.floor(Date.now() / 1000)),
        token: 'a'.repeat(64),
      }
      beforeAll(async () => {
        analytics = await import('@/utilities/orderAnalytics')
        await analytics.initializeAnalytics(payload)
      })
      beforeEach(async () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('VERCEL_ENV', 'production')
        vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
        vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true')
        vi.stubEnv('NEXT_PUBLIC_GA4_ID', 'G-TEST123')
        vi.stubEnv('ANALYTICS_SERVER_ENABLED', 'true')
        vi.stubEnv('ANALYTICS_DELIVERY_MODE', 'validate')
        vi.stubEnv('GA4_API_SECRET', 'synthetic-never-sent')
        for (const name of Object.values(analytics.ANALYTICS))
          await commerce.mongoCommerce(payload).db.collection(name).deleteMany({})
      })
      afterEach(() => {
        vi.stubEnv('ANALYTICS_SERVER_ENABLED', 'false')
        vi.stubEnv('NODE_ENV', 'test')
      })
      const jobs = () => commerce.mongoCommerce(payload).db.collection(analytics.ANALYTICS.outbox)
      const withAnalytics = (
        data: ReturnType<typeof input>,
        key = checkout.checkoutKey(randomUUID()),
        context: unknown = attribution,
      ) => checkout.executeCheckout(payload, data, 1350, key, undefined, context)

      it('concurrent retries queue one immutable event per milestone, never customer data', async () => {
        const item = await product(5),
          key = checkout.checkoutKey(randomUUID())
        const results = await Promise.all([
          withAnalytics(input(item.id), key),
          withAnalytics(input(item.id), key),
        ])
        expect(results.filter((result) => 'replayed' in result && result.replayed)).toHaveLength(1)
        expect(await jobs().countDocuments()).toBe(2)
        const result = results[0]
        if (!('orderId' in result)) throw new Error('Missing order')
        await status(result.orderId, 'cancelled')
        await status(result.orderId, 'confirmed')
        expect(await jobs().countDocuments()).toBe(2)
        const saved = await jobs().find().toArray()
        expect(saved.every((job) => job.attempts === 0 && job.event.params.value === 1000)).toBe(
          true,
        )
        expect(JSON.stringify(saved)).not.toMatch(
          /Test Buyer|test@example|030011|Synthetic test address/,
        )
      })
      it('does not queue denied, missing, malformed or newly-attributed replayed orders', async () => {
        const item = await product(5),
          key = checkout.checkoutKey(randomUUID())
        await withAnalytics(input(item.id), key, { ...attribution, consent: 'denied' })
        await withAnalytics(input(item.id), key)
        await withAnalytics(input(item.id), undefined, {
          ...attribution,
          clientId: 'private@example.invalid',
        })
        await purchase(input(item.id))
        expect(await jobs().countDocuments()).toBe(0)
      })
      it('rolls back analytics, order and stock together', async () => {
        const item = await product(5)
        await expect(
          commerce.commerceTransaction(payload, null, async (req) => {
            req.context.orderAnalytics = attribution
            await payload.create({
              collection: 'orders',
              req,
              draft: false,
              data: {
                orderNumber: `QA-${randomUUID()}`,
                customer: input(item.id).customer,
                paymentMethod: 'cod',
                status: 'confirmed',
                shippingFee: 250,
                codFee: 100,
                subtotal: 1000,
                totalAmount: 1350,
                items: [{ product: item.id, variantSize: 'M', quantity: 1, unitPrice: 1000 }],
              },
            })
            throw new Error('synthetic rollback')
          }),
        ).rejects.toThrow('synthetic rollback')
        expect(await jobs().countDocuments()).toBe(0)
        expect((await payload.count({ collection: 'orders' })).totalDocs).toBe(0)
        expect(await stock(item.id)).toBe(5)
      })
      it('delays transfer purchase until confirmation and deduplicates re-confirmation', async () => {
        const item = await product(5)
        const data = {
          ...input(item.id),
          paymentMethod: 'jazzcash' as const,
          paymentProof: { transactionId: 'QA12345678', screenshot: undefined },
        }
        const result = await checkout.executeCheckout(
          payload,
          data,
          1250,
          checkout.checkoutKey(randomUUID()),
          undefined,
          attribution,
        )
        if (!('orderId' in result)) throw new Error('Missing order')
        expect(await jobs().countDocuments()).toBe(1)
        await status(result.orderId, 'confirmed')
        await status(result.orderId, 'cancelled')
        await status(result.orderId, 'confirmed')
        expect(await jobs().countDocuments()).toBe(2)
        const job = await jobs().findOne({ 'event.name': 'purchase' })
        expect(job?.event.params.payment_status).toBe('transfer_confirmed')
      })
      it('validates without collection, then never auto-replays a validated job', async () => {
        await withAnalytics(input((await product(5)).id))
        const fetch = vi
          .fn()
          .mockResolvedValue({ ok: true, json: async () => ({ validationMessages: [] }) })
        vi.stubGlobal('fetch', fetch)
        expect(await analytics.dispatchOrderAnalytics(payload)).toMatchObject({
          validated: 2,
          accepted: 0,
        })
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(String(fetch.mock.calls[0][0])).toContain('/debug/mp/collect')
        const body = JSON.parse(fetch.mock.calls[0][1].body)
        expect(body).toMatchObject({
          client_id: attribution.clientId,
          validation_behavior: 'ENFORCE_RECOMMENDATIONS',
          consent: { ad_personalization: 'DENIED' },
        })
        expect(JSON.stringify(body)).not.toContain(attribution.token)
        await analytics.dispatchOrderAnalytics(payload)
        expect(fetch).toHaveBeenCalledTimes(2)
      })
      it('quarantines timeout sends without blind retry; expired leases do not resend', async () => {
        await withAnalytics(input((await product(5)).id))
        vi.stubEnv('ANALYTICS_DELIVERY_MODE', 'collect')
        const fetch = vi.fn().mockRejectedValue(new Error('synthetic timeout'))
        vi.stubGlobal('fetch', fetch)
        expect(await analytics.dispatchOrderAnalytics(payload, 1)).toMatchObject({ review: 1 })
        await jobs().updateOne(
          { state: 'pending' },
          { $set: { state: 'processing', attempts: 1, availableAt: new Date(0) } },
        )
        expect(await analytics.dispatchOrderAnalytics(payload)).toMatchObject({ review: 1 })
        expect(fetch).toHaveBeenCalledTimes(1)
      })
      it('withdrawal blocks pending and future milestones, including revoke-before-checkout', async () => {
        const item = await product(5)
        await withAnalytics(input(item.id))
        await analytics.revokeOrderAnalytics(payload, attribution.token)
        await withAnalytics(input(item.id))
        expect(await jobs().countDocuments({ state: 'suppressed' })).toBe(2)
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        await analytics.dispatchOrderAnalytics(payload)
        expect(fetch).not.toHaveBeenCalled()
      })
      it('expires old events and withholds stale session attribution', async () => {
        await withAnalytics(input((await product(5)).id))
        await jobs().updateOne(
          { 'event.name': 'order_placed' },
          { $set: { createdAt: new Date(Date.now() - 71 * 3600000) } },
        )
        await jobs().updateMany({}, { $set: { capturedAt: new Date(Date.now() - 25 * 3600000) } })
        const fetch = vi
          .fn()
          .mockResolvedValue({ ok: true, json: async () => ({ validationMessages: [] }) })
        vi.stubGlobal('fetch', fetch)
        expect(await analytics.dispatchOrderAnalytics(payload)).toMatchObject({
          suppressed: 1,
          validated: 1,
        })
        expect(JSON.parse(fetch.mock.calls[0][1].body).events[0].params).not.toHaveProperty(
          'session_id',
        )
      })
      it('concurrent workers claim different events and persist collection acceptance only', async () => {
        await withAnalytics(input((await product(5)).id))
        vi.stubEnv('ANALYTICS_DELIVERY_MODE', 'collect')
        const fetch = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetch)
        await Promise.all([
          analytics.dispatchOrderAnalytics(payload),
          analytics.dispatchOrderAnalytics(payload),
        ])
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(await jobs().countDocuments({ state: 'accepted' })).toBe(2)
        const events = fetch.mock.calls.map((call) => JSON.parse(call[1].body).events[0].name)
        expect(new Set(events)).toEqual(new Set(['order_placed', 'purchase']))
      })
      it('invalid validation responses and rejected requests require review, not retry', async () => {
        await withAnalytics(input((await product(5)).id))
        const fetch = vi
          .fn()
          .mockResolvedValueOnce({ ok: false })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ validationMessages: [{ description: 'synthetic' }] }),
          })
        vi.stubGlobal('fetch', fetch)
        expect(await analytics.dispatchOrderAnalytics(payload)).toMatchObject({ review: 2 })
        expect(await jobs().countDocuments({ state: 'review' })).toBe(2)
        await analytics.dispatchOrderAnalytics(payload)
        expect(fetch).toHaveBeenCalledTimes(2)
      })
      it('does not claim jobs with incomplete delivery configuration', async () => {
        await withAnalytics(input((await product(5)).id))
        vi.stubEnv('GA4_API_SECRET', '')
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        await expect(analytics.dispatchOrderAnalytics(payload)).rejects.toThrow(
          'configuration is incomplete',
        )
        expect(await jobs().countDocuments({ state: 'pending', attempts: 0 })).toBe(2)
        expect(fetch).not.toHaveBeenCalled()
      })
      it('does not invent a purchase after its checkout context has expired', async () => {
        const item = await product(5)
        const data = {
          ...input(item.id),
          paymentMethod: 'jazzcash' as const,
          paymentProof: { transactionId: 'QA12345678', screenshot: undefined },
        }
        const result = await checkout.executeCheckout(
          payload,
          data,
          1250,
          checkout.checkoutKey(randomUUID()),
          undefined,
          attribution,
        )
        if (!('orderId' in result)) throw new Error('Missing order')
        await commerce
          .mongoCommerce(payload)
          .db.collection(analytics.ANALYTICS.context)
          .updateMany({}, { $set: { expiresAt: new Date(0) } })
        await status(result.orderId, 'confirmed')
        expect(await jobs().countDocuments()).toBe(1)
        expect(await jobs().countDocuments({ 'event.name': 'purchase' })).toBe(0)
      })
    })
    describe('operational reports on real MongoDB', () => {
      let reports: typeof import('@/lib/reports/service')
      let filters: typeof import('@/lib/reports/filters')
      beforeAll(async () => {
        reports = await import('@/lib/reports/service')
        filters = await import('@/lib/reports/filters')
        await reports.initializeReports(payload, admin)
      })
      const read = (query = '', exporting = false) =>
        reports.getOperationalReport(
          payload,
          admin,
          filters.parseReportFilters(
            new URLSearchParams(`start=2026-10-25&end=2026-10-25&${query}`),
          ),
          exporting,
        )
      const rawOrders = () => {
        const { db, adapter } = commerce.mongoCommerce(payload)
        return db.collection(adapter.collections.orders.collection.collectionName)
      }
      const rawProducts = () => {
        const { db, adapter } = commerce.mongoCommerce(payload)
        return db.collection(adapter.collections.products.collection.collectionName)
      }
      const row = (extra: Record<string, unknown> = {}) => ({
        orderNumber: `REPORT-${randomUUID()}`,
        createdAt: new Date('2026-10-25T09:00:00Z'),
        status: 'confirmed',
        paymentMethod: 'cod',
        customer: {
          name: 'PRIVATE BUYER',
          email: 'private@example.invalid',
          phone: '03001112222',
          address: 'PRIVATE ADDRESS',
          city: 'Lahore',
        },
        subtotal: 1000,
        shippingFee: 250,
        codFee: 100,
        totalAmount: 1350,
        items: [{ product: 'unknown', variantSize: 'M', quantity: 1, unitPrice: 1000 }],
        ...extra,
      })
      it('covers every matching order beyond old caps, paginates details and exports all rows', async () => {
        await rawOrders().insertMany(
          Array.from({ length: 503 }, (_, index) =>
            row({ status: index === 502 ? 'cancelled' : 'confirmed' }),
          ),
        )
        const result = await read('view=orders&page=11')
        expect(result.summary).toMatchObject({
          orders: 503,
          acceptedOrders: 502,
          acceptedValue: 502 * 1350,
          units: 503,
        })
        expect(result.pagination).toMatchObject({ totalRows: 503, totalPages: 11 })
        expect(result.rows).toHaveLength(3)
        expect(result.exportReady).toBe(true)
        const exported = await read('view=orders&page=11', true)
        expect(exported.rows).toHaveLength(503)
        expect(JSON.stringify(exported)).not.toMatch(
          /PRIVATE BUYER|private@example|030011|PRIVATE ADDRESS/,
        )
      })
      it('uses exact Karachi boundaries, prior-period comparison and zero-filled days', async () => {
        await rawOrders().insertMany([
          row({ createdAt: new Date('2026-10-24T18:59:59.999Z') }),
          row({ createdAt: new Date('2026-10-24T19:00:00.000Z') }),
          row({ createdAt: new Date('2026-10-25T18:59:59.999Z') }),
          row({ createdAt: new Date('2026-10-25T19:00:00.000Z') }),
        ])
        const result = await read()
        expect(result.summary.orders).toBe(2)
        expect(result.trend).toEqual([{ day: '2026-10-25', orders: 2, value: 2700 }])
        expect(result.comparison?.orders).toEqual({ absolute: 1, percent: 100 })
        const empty = await read('view=orders&status=cancelled')
        expect(empty.summary.orders).toBe(0)
        expect(empty.summary.averageAcceptedValue).toBeNull()
        expect(empty.summary.cancellationRate).toBeNull()
        expect(empty.trend[0].orders).toBe(0)
        expect(empty.comparison?.orders.percent).toBeNull()
      })
      it('filters status, method, city and courier without exposing payment-proof fields', async () => {
        await rawOrders().insertMany([
          row(),
          row({
            paymentMethod: 'jazzcash',
            status: 'pending_verification',
            paymentProof: { transactionId: 'PRIVATE-REFERENCE' },
            fulfillment: { courierName: 'TCS' },
          }),
          row({ paymentMethod: 'jazzcash', status: 'confirmed', customer: { city: 'Karachi' } }),
        ])
        const result = await read(
          'view=payments&payment=jazzcash&status=pending_verification&city=lahore&courier=TCS',
        )
        expect(result.summary).toMatchObject({
          orders: 1,
          acceptedValue: 0,
          pendingVerification: 1,
        })
        expect(result.breakdowns.courier).toEqual([{ label: 'TCS', orders: 1, value: 1350 }])
        expect(JSON.stringify(result)).not.toContain('PRIVATE-REFERENCE')
        expect(result.unavailable.join(' ')).toMatch(/separate recorded payments/)
      })
      it('ranks multi-line products by item value, counts each order once and includes zero-order products', async () => {
        const item = await product(10),
          other = await product(10),
          zero = await product(10)
        const a = (await rawProducts().findOne({ slug: item.slug }))!,
          b = (await rawProducts().findOne({ slug: other.slug }))!
        await rawOrders().insertMany([
          row({
            subtotal: 3100,
            totalAmount: 3450,
            items: [
              { product: a._id, quantity: 2, unitPrice: 800, variantSize: 'M' },
              { product: a._id, quantity: 1, unitPrice: 1000, variantSize: 'L' },
              { product: b._id, quantity: 1, unitPrice: 500, variantSize: 'M' },
            ],
          }),
          row({ status: 'cancelled', items: [{ product: a._id, quantity: 99, unitPrice: 1000 }] }),
        ])
        const result = await read('view=products')
        expect(result.summary).toMatchObject({
          products: 3,
          units: 4,
          merchandiseValue: 3100,
          zeroOrderProducts: 1,
        })
        expect(result.rows.find((value) => value.id === String(item.id))).toMatchObject({
          units: 3,
          orders: 1,
          merchandiseValue: 2600,
        })
        expect(result.rows.find((value) => value.id === String(zero.id))).toMatchObject({
          units: 0,
          orders: 0,
        })
        const cohort = await read(`view=orders&product=${item.id}`)
        expect(cohort.summary.placedValue).toBe(4800) // Entire matching orders, including cancelled.
        const selected = await read(`view=products&product=${item.id}&category=${category}`)
        expect(selected.summary).toMatchObject({ products: 1, units: 3, merchandiseValue: 2600 })
      })
      it('keeps deleted product IDs reportable and labels current catalog metadata as unavailable', async () => {
        const { ObjectId } = await import('mongodb')
        const missing = new ObjectId()
        await rawOrders().insertOne(
          row({ items: [{ product: missing, quantity: 2, unitPrice: 700, variantSize: 'M' }] }),
        )
        const result = await read('view=products')
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0]).toMatchObject({
          id: missing.toHexString(),
          title: 'Deleted / unavailable product',
          merchandiseValue: 1400,
          units: 2,
          productStatus: 'unavailable',
        })
      })
      it('aggregates all variants beyond product caps, distinguishes unknown/zero and honors a free price override', async () => {
        const item = await product(10)
        const a = (await rawProducts().findOne({ slug: item.slug }))!
        await rawProducts().deleteMany({})
        const docs = Array.from({ length: 305 }, (_, index) => ({
          title: `Product ${String(index).padStart(4, '0')}`,
          status: 'published',
          primaryCategory: a.primaryCategory,
          basePricePKR: 1000,
          variants: [
            {
              id: `m-${index}`,
              size: a.variants[0].size,
              sku: `SKU-${index}-M`,
              stock: index === 0 ? 2 : 10,
              pricePKR: index === 0 ? 0 : null,
            },
            {
              id: `l-${index}`,
              size: a.variants[0].size,
              sku: `SKU-${index}-L`,
              stock: index === 0 ? 0 : index === 1 ? null : 10,
              allowBackorder: index === 0,
            },
          ],
        }))
        await rawProducts().insertMany(docs)
        const result = await read('view=inventory&page=13')
        expect(result.summary).toMatchObject({
          variants: 610,
          inStock: 608,
          lowStock: 1,
          outOfStock: 1,
          unknownStock: 1,
          backorderEnabled: 1,
          stockUnits: 6072,
          retailStockValue: 6070000,
        })
        expect(result.pagination).toMatchObject({ totalRows: 610, totalPages: 13 })
        expect(result.rows).toHaveLength(10)
        const low = await read('view=inventory&stock=low_stock')
        expect(low.rows).toHaveLength(1)
        expect(low.rows[0]).toMatchObject({
          stock: 2,
          price: 0,
          retailValue: 0,
          stockState: 'low_stock',
        })
        const out = await read('view=inventory&stock=out_of_stock')
        expect(out.rows[0]).toMatchObject({ stock: 0, backorder: true })
        const unknown = await read('view=inventory&stock=unknown')
        expect(unknown.rows[0].stock).toBeNull()
      })
      it('refuses oversized synchronous exports rather than silently truncating', async () => {
        await rawOrders().insertMany(Array.from({ length: 5001 }, () => row()))
        await expect(read('view=orders', true)).rejects.toMatchObject({ status: 413 })
        expect((await read('view=orders')).pagination.totalRows).toBe(5001)
      })
    })
    describe('manual actual-money ledger and refunds', () => {
      let money: typeof import('@/utilities/paymentLedger')
      let reports: typeof import('@/lib/payments/report')
      beforeAll(async () => {
        money = await import('@/utilities/paymentLedger')
        reports = await import('@/lib/payments/report')
        await money.initializeMoney(payload, admin)
      })
      beforeEach(async () => {
        for (const name of Object.values(money.MONEY))
          await commerce.mongoCommerce(payload).db.collection(name).deleteMany({})
      })
      const entryCollection = () =>
        commerce
          .mongoCommerce(payload)
          .db.collection<import('@/utilities/commerceDatabase').InternalRecord>(money.MONEY.entries)
      const createOrder = async () => {
        const item = await product(10)
        const result = await purchase(input(item.id))
        if (!('orderId' in result)) throw new Error('No order')
        return {
          item,
          order: await payload.findByID({ collection: 'orders', id: result.orderId, depth: 0 }),
        }
      }
      const command = (orderId: string | number, amount = '500') => ({
        key: randomUUID(),
        orderId: String(orderId),
        kind: 'collection',
        amount,
        method: 'cash',
        reason: 'customer_payment',
        occurredAt: new Date().toISOString(),
      })
      const refund = (payment: ReturnType<typeof command>, amount = '100') => ({
        ...command(payment.orderId, amount),
        kind: 'refund',
        reason: 'return',
        refundOf: payment.key,
      })
      const read = (query = '') => reports.moneyReport(payload, admin, new URLSearchParams(query))
      it('records partial collections/refunds without changing order status, stock, content or timestamps', async () => {
        const { item, order } = await createOrder(),
          payment = command(order.id, '500.25')
        const before = await payload.findByID({ collection: 'orders', id: order.id, depth: 0 })
        await money.recordMoney(payload, admin, payment)
        await money.recordMoney(payload, admin, refund(payment, '100.01'))
        await money.recordMoney(payload, admin, refund(payment, '200.02'))
        const report = await read(`orderId=${order.id}`)
        expect(report.summary).toMatchObject({
          collectedMinor: 50025,
          refundedMinor: 30003,
          netMovementMinor: 20022,
        })
        expect(report.order).toMatchObject({
          collectedMinor: 50025,
          refundedMinor: 30003,
          hasEntries: true,
        })
        expect(await payload.findByID({ collection: 'orders', id: order.id, depth: 0 })).toEqual(
          before,
        )
        expect(await stock(item.id)).toBe(9)
        expect(JSON.stringify(report)).not.toMatch(
          /test@example|030011|Synthetic test address|fingerprint|paymentProof/,
        )
      })
      it('replays concurrent identical commands once and refuses mismatched key reuse', async () => {
        const { order } = await createOrder(),
          payment = command(order.id)
        const results = await Promise.all([
          money.recordMoney(payload, admin, payment),
          money.recordMoney(payload, admin, payment),
        ])
        expect(results.map((r) => r.replayed).sort()).toEqual([false, true])
        expect(await entryCollection().countDocuments()).toBe(1)
        await expect(
          money.recordMoney(payload, admin, { ...payment, amount: '501' }),
        ).rejects.toMatchObject({ status: 409 })
      })
      it('serializes competing collections at the order cap', async () => {
        const { order } = await createOrder()
        const results = await Promise.allSettled([
          money.recordMoney(payload, admin, command(order.id, '1000')),
          money.recordMoney(payload, admin, command(order.id, '1000')),
        ])
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
        expect((await read()).summary.collectedMinor).toBe(100000)
      })
      it('serializes refunds against the remaining linked collection and order balance', async () => {
        const { order } = await createOrder(),
          payment = command(order.id)
        await money.recordMoney(payload, admin, payment)
        const results = await Promise.allSettled([
          money.recordMoney(payload, admin, refund(payment, '400')),
          money.recordMoney(payload, admin, refund(payment, '400')),
        ])
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
        expect((await read()).summary.refundedMinor).toBe(40000)
      })
      it('refuses unrelated collection IDs, pre-order dates and refunds before collection time', async () => {
        const first = await createOrder(),
          second = await createOrder(),
          payment = command(first.order.id)
        await money.recordMoney(payload, admin, payment)
        await expect(
          money.recordMoney(payload, admin, {
            ...refund(payment),
            orderId: String(second.order.id),
          }),
        ).rejects.toThrow('belonging')
        await expect(
          money.recordMoney(payload, admin, {
            ...command(first.order.id),
            occurredAt: '2020-01-01T00:00:00Z',
          }),
        ).rejects.toThrow('creation')
        const later = {
          ...command(first.order.id, '10'),
          occurredAt: new Date(Date.now() + 60000).toISOString(),
        }
        await money.recordMoney(payload, admin, later)
        await expect(money.recordMoney(payload, admin, refund(later, '1'))).rejects.toThrow(
          'precede its collection',
        )
      })
      it('allows cancellation and refunds, never infers money, and retains funded orders', async () => {
        const { order } = await createOrder(),
          payment = command(order.id)
        await money.recordMoney(payload, admin, payment)
        await status(order.id, 'cancelled')
        expect((await read()).summary.refundedMinor).toBe(0)
        await expect(
          money.recordMoney(payload, admin, command(order.id, '1')),
        ).rejects.toMatchObject({ status: 422 })
        await money.recordMoney(payload, admin, refund(payment, '500'))
        await expect(
          payload.delete({
            collection: 'orders',
            id: order.id,
            user: admin,
            overrideAccess: false,
          }),
        ).rejects.toThrow('cannot be deleted')
        expect(await entryCollection().countDocuments()).toBe(2)
      })
      it('freezes financial snapshots but permits ordinary admin notes', async () => {
        const { order } = await createOrder()
        await money.recordMoney(payload, admin, command(order.id))
        await expect(
          payload.update({
            collection: 'orders',
            id: order.id,
            data: { shippingFee: 300 },
            user: admin,
            overrideAccess: false,
          }),
        ).rejects.toThrow('locked')
        await expect(
          payload.update({
            collection: 'orders',
            id: order.id,
            data: { items: order.items.map((item) => ({ ...item, unitPrice: 999 })) },
            user: admin,
            overrideAccess: false,
          }),
        ).rejects.toThrow('locked')
        await payload.update({
          collection: 'orders',
          id: order.id,
          data: { notes: 'Internal QA note' },
          user: admin,
          overrideAccess: false,
        })
        expect(await entryCollection().countDocuments()).toBe(1)
      })
      it('rolls back an entry if writing its derived balance fails', async () => {
        const { order } = await createOrder(),
          { db } = commerce.mongoCommerce(payload)
        const proto = Object.getPrototypeOf(db.collection(money.MONEY.balances))
        const original = proto.updateOne
        const spy = vi.spyOn(proto, 'updateOne').mockImplementation(function (
          this: { collectionName: string },
          ...args: unknown[]
        ) {
          if (this.collectionName === money.MONEY.balances)
            throw new Error('Synthetic balance failure')
          return original.apply(this, args)
        })
        try {
          await expect(money.recordMoney(payload, admin, command(order.id))).rejects.toThrow(
            'Synthetic balance failure',
          )
        } finally {
          spy.mockRestore()
        }
        expect(await entryCollection().countDocuments()).toBe(0)
        expect((await read()).summary.netMovementMinor).toBe(0)
      })
      it('reports occurrence dates separately, paginates all matches and exports audited PKR amounts', async () => {
        const { order } = await createOrder(),
          payment = command(order.id, '53')
        await money.recordMoney(payload, admin, payment)
        for (let i = 0; i < 51; i++) await money.recordMoney(payload, admin, refund(payment, '1'))
        const report = await read(`orderId=${order.id}`)
        expect(report.rows).toHaveLength(50)
        expect(report.summary.records).toBe(52)
        expect((await read(`orderId=${order.id}&page=2`)).rows).toHaveLength(2)
        const exported = await read(`orderId=${order.id}&format=csv`)
        const csv = await reports.moneyCSV(payload, admin, exported)
        expect(csv.trim().split('\r\n')).toHaveLength(53)
        expect(csv).toContain('"53.00"')
        expect(csv).not.toMatch(/fingerprint|paymentProof|test@example|Synthetic test address/)
        expect(
          await commerce.mongoCommerce(payload).db.collection(money.MONEY.audit).countDocuments(),
        ).toBe(1)
      })
      it('refuses oversized exports rather than silently truncating', async () => {
        await entryCollection().insertMany(
          Array.from({ length: 5001 }, () => ({
            _id: randomUUID(),
            occurredAt: new Date(),
            kind: 'collection',
            amountMinor: 100,
          })),
        )
        await expect(read('format=csv')).rejects.toMatchObject({ status: 413 })
      })
      it('fails closed when export audit persistence fails', async () => {
        const { order } = await createOrder()
        await money.recordMoney(payload, admin, command(order.id))
        const report = await read('format=csv'),
          { db } = commerce.mongoCommerce(payload)
        const proto = Object.getPrototypeOf(db.collection(money.MONEY.audit)),
          original = proto.insertOne
        const spy = vi.spyOn(proto, 'insertOne').mockImplementation(function (
          this: { collectionName: string },
          ...args: unknown[]
        ) {
          if (this.collectionName === money.MONEY.audit) throw new Error('Synthetic audit failure')
          return original.apply(this, args)
        })
        try {
          await expect(reports.moneyCSV(payload, admin, report)).rejects.toThrow(
            'Synthetic audit failure',
          )
        } finally {
          spy.mockRestore()
        }
      })
      it('uses Karachi occurrence boundaries without filtering all-time order balances', async () => {
        const { order } = await createOrder(),
          before = new Date('2026-10-23T18:59:59.999Z'),
          at = new Date('2026-10-23T19:00:00Z')
        await entryCollection().insertMany([
          {
            _id: randomUUID(),
            orderId: String(order.id),
            kind: 'collection',
            amountMinor: 10000,
            occurredAt: before,
            recordedAt: new Date(),
          },
          {
            _id: randomUUID(),
            orderId: String(order.id),
            kind: 'refund',
            amountMinor: 2000,
            occurredAt: at,
            recordedAt: new Date(),
          },
        ])
        const report = await read(`orderId=${order.id}&start=2026-10-24&end=2026-10-24`)
        expect(report.summary).toMatchObject({
          records: 1,
          collectedMinor: 0,
          refundedMinor: 2000,
          netMovementMinor: -2000,
        })
        expect(report.rows[0].occurredAt).toEqual(at)
        // Raw fixtures are deliberately not a derived balance. Missing balance is explicitly uncovered.
        expect(report.order?.hasEntries).toBe(false)
      })
      it('serializes financial order edits with payment recording', async () => {
        const { order } = await createOrder()
        const results = await Promise.allSettled([
          money.recordMoney(payload, admin, command(order.id)),
          commerce.commerceTransaction(payload, admin, (req) =>
            payload.update({
              collection: 'orders',
              id: order.id,
              req,
              user: admin,
              overrideAccess: false,
              data: { shippingFee: 300 },
            }),
          ),
        ])
        expect(results[0].status).toBe('fulfilled')
        const current = await payload.findByID({ collection: 'orders', id: order.id, depth: 0 })
        expect(current.totalAmount).toBe(results[1].status === 'fulfilled' ? 1400 : 1350)
        expect((await read()).summary.collectedMinor).toBe(50000)
        await expect(
          payload.update({
            collection: 'orders',
            id: order.id,
            data: { shippingFee: 350 },
            user: admin,
            overrideAccess: false,
          }),
        ).rejects.toThrow('locked')
      })
      it('fails closed on derived balance drift and still prevents deleting ledger-backed orders', async () => {
        const { order } = await createOrder(),
          payment = command(order.id)
        await money.recordMoney(payload, admin, payment)
        await commerce.mongoCommerce(payload).db.collection(money.MONEY.balances).deleteMany({})
        await expect(money.recordMoney(payload, admin, command(order.id, '1'))).rejects.toThrow(
          'reconciliation',
        )
        await status(order.id, 'cancelled')
        await expect(
          payload.delete({
            collection: 'orders',
            id: order.id,
            user: admin,
            overrideAccess: false,
          }),
        ).rejects.toThrow('cannot be deleted')
        expect(await entryCollection().countDocuments()).toBe(1)
      })
    })
    describe('durable order milestones and complete product-write stock ledger', () => {
      let operations: typeof import('@/utilities/operationsHistory')
      let activity: typeof import('@/lib/reports/operations')
      beforeAll(async () => {
        operations = await import('@/utilities/operationsHistory')
        activity = await import('@/lib/reports/operations')
        await operations.initializeOperations(payload, admin)
      })
      beforeEach(async () => {
        for (const name of Object.values(operations.OPERATIONS))
          await commerce.mongoCommerce(payload).db.collection(name).deleteMany({})
      })
      const collection = (name: keyof typeof operations.OPERATIONS) =>
        commerce
          .mongoCommerce(payload)
          .db.collection<import('@/utilities/commerceDatabase').InternalRecord>(
            operations.OPERATIONS[name],
          )
      const setReady = (ready: boolean) =>
        commerce
          .mongoCommerce(payload)
          .db.collection<import('@/utilities/commerceDatabase').InternalRecord>(
            commerce.COMMERCE.config,
          )
          .updateOne({ _id: 'operations-v1' }, { $set: { ready } })
      const adjust = (id: number | string, next: number, reason = 'restock') =>
        commerce.commerceTransaction(payload, admin, async (req) => {
          const item = await payload.findByID({ collection: 'products', id, req, depth: 0 })
          return payload.update({
            collection: 'products',
            id,
            req,
            data: {
              variants: item.variants!.map((v) => ({
                ...v,
                size: typeof v.size === 'object' ? v.size.id : v.size,
                stock: next,
              })),
            },
            context: { commerceInventoryWrite: true, stockReason: reason },
          })
        })
      it('records checkout/replay/cancel/reopen once and preserves first-confirmation value/time', async () => {
        const item = await product(10),
          key = checkout.checkoutKey(randomUUID())
        const result = await purchase(input(item.id), key)
        if (!('orderId' in result)) throw new Error('Missing order')
        await purchase(input(item.id), key)
        const first = await collection('milestones').findOne({ _id: String(result.orderId) })
        expect(first?.coverage).toBe('since_creation')
        expect(first?.firstConfirmedValue).toBe(1350)
        expect(first?.creationItems[0]).toMatchObject({
          title: 'Test suit',
          unitPrice: 1000,
          quantity: 1,
        })
        expect(await collection('history').countDocuments()).toBe(1)
        expect(
          await collection('stock').countDocuments({
            kind: 'order_allocation',
            orderId: String(result.orderId),
            delta: -1,
          }),
        ).toBe(1)
        await status(result.orderId, 'cancelled')
        await status(result.orderId, 'cancelled')
        await status(result.orderId, 'confirmed')
        expect(await collection('history').countDocuments()).toBe(3)
        const latest = await collection('milestones').findOne({ _id: String(result.orderId) })
        expect(latest?.firstConfirmedAt).toEqual(first?.firstConfirmedAt)
        expect(latest?.firstConfirmedValue).toBe(1350)
        const ledger = await collection('stock')
          .find({ productId: String(item.id) })
          .sort({ sequence: 1 })
          .toArray()
        expect(ledger.reduce((sum, row) => sum + row.delta, ledger[0].after)).toBe(9)
        expect(await stock(item.id)).toBe(9)
      })
      it('records physical backorder deductions/restorations separately from requested demand', async () => {
        const item = await product(1, true)
        const result = await purchase(input(item.id, 3), undefined, 3350)
        if (!('orderId' in result)) throw new Error('Missing order')
        expect(
          await collection('history').findOne({ orderId: String(result.orderId) }),
        ).toMatchObject({ requestedUnits: 3, deductedUnits: 1, backorderedUnits: 2 })
        expect(await collection('stock').findOne({ kind: 'order_allocation' })).toMatchObject({
          before: 1,
          after: 0,
          delta: -1,
        })
        await status(result.orderId, 'cancelled')
        expect(await collection('stock').findOne({ kind: 'order_restore' })).toMatchObject({
          before: 0,
          after: 1,
          delta: 1,
        })
        expect(await stock(item.id)).toBe(1)
      })
      it('rolls back order, stock, milestones and history together', async () => {
        const item = await product(5),
          before = await collection('stock').countDocuments()
        await expect(
          commerce.commerceTransaction(payload, null, async (req) => {
            await payload.create({
              collection: 'orders',
              req,
              draft: false,
              data: {
                orderNumber: `OPS-${randomUUID()}`,
                customer: input(item.id).customer,
                paymentMethod: 'cod',
                status: 'confirmed',
                subtotal: 1000,
                totalAmount: 1350,
                shippingFee: 250,
                codFee: 100,
                items: [{ product: item.id, variantSize: 'M', quantity: 1, unitPrice: 1000 }],
              },
            })
            throw new Error('synthetic history rollback')
          }),
        ).rejects.toThrow('synthetic history rollback')
        expect(await collection('history').countDocuments()).toBe(0)
        expect(await collection('milestones').countDocuments()).toBe(0)
        expect(await collection('stock').countDocuments()).toBe(before)
        expect(await stock(item.id)).toBe(5)
      })
      it('records manual adjustments and ignores unchanged stock/metadata-only writes', async () => {
        const item = await product(5)
        await adjust(item.id, 12)
        expect(await collection('stock').findOne({ kind: 'restock' })).toMatchObject({
          before: 5,
          after: 12,
          delta: 7,
          actorId: String(admin.id),
        })
        const count = await collection('stock').countDocuments()
        await adjust(item.id, 12)
        await payload.update({
          collection: 'products',
          id: item.id,
          data: { title: 'Renamed suit' },
          context: { skipShoppableVideoSync: true },
        })
        expect(await collection('stock').countDocuments()).toBe(count)
        expect((await activity.operationsStatus(payload, admin)).driftedVariants).toBe(0)
      })
      it('retains retirement movements for removed variants and deleted products', async () => {
        const item = await product(5)
        await payload.update({
          collection: 'products',
          id: item.id,
          data: { variants: [] },
          context: { skipShoppableVideoSync: true },
        })
        expect(await collection('stock').findOne({ kind: 'variant_removed' })).toMatchObject({
          delta: -5,
          after: 0,
        })
        const other = await product(4)
        await payload.delete({
          collection: 'products',
          id: other.id,
          context: { skipShoppableVideoSync: true },
        })
        expect(await collection('stock').findOne({ kind: 'product_deleted' })).toMatchObject({
          delta: -4,
          after: 0,
        })
        expect(await collection('balances').countDocuments({ active: true })).toBe(0)
      })
      it('does not invent first milestones for legacy orders already present at activation', async () => {
        await setReady(false)
        const item = await product(5),
          result = await purchase(input(item.id))
        if (!('orderId' in result)) throw new Error('Missing order')
        await setReady(true)
        await status(result.orderId, 'cancelled')
        await status(result.orderId, 'confirmed')
        const state = await collection('milestones').findOne({ _id: String(result.orderId) })
        expect(state?.coverage).toBe('partial_legacy')
        expect(state?.firstConfirmedAt).toBeUndefined()
        expect(state?.placedAt).toBeUndefined()
        expect(await collection('history').countDocuments()).toBe(2)
      })
      it('captures bounded resumable baselines without modifying original product records', async () => {
        await setReady(false)
        for (let index = 0; index < 27; index++) await product(5)
        await setReady(true)
        const { db, adapter } = commerce.mongoCommerce(payload)
        const products = db.collection(adapter.collections.products.collection.collectionName)
        const original = await products.find().sort({ _id: 1 }).toArray()
        const first = await operations.captureInventoryBaselines(payload, admin)
        expect(first.processed).toBe(25)
        expect(first.nextCursor).toBeTruthy()
        const last = await operations.captureInventoryBaselines(payload, admin, first.nextCursor!)
        expect(last).toMatchObject({ processed: 2, nextCursor: null })
        await operations.captureInventoryBaselines(payload, admin)
        expect(await collection('stock').countDocuments()).toBe(27)
        expect(await products.find().sort({ _id: 1 }).toArray()).toEqual(original)
        expect(await activity.operationsStatus(payload, admin)).toMatchObject({
          currentVariants: 27,
          trackedVariants: 27,
          driftedVariants: 0,
        })
      })
      it('baseline capture races safely with checkout and does not lose a stock movement', async () => {
        await setReady(false)
        const item = await product(10)
        await setReady(true)
        await Promise.all([
          operations.captureInventoryBaselines(payload, admin),
          purchase(input(item.id)),
        ])
        const balance = await collection('balances').findOne({ productId: String(item.id) })
        expect(balance?.stock).toBe(9)
        const ledger = await collection('stock')
          .find({ productId: String(item.id) })
          .sort({ sequence: 1 })
          .toArray()
        expect(ledger.reduce((sum, value) => sum + value.delta, ledger[0].after)).toBe(9)
        expect((await activity.operationsStatus(payload, admin)).driftedVariants).toBe(0)
      })
      it('refuses to overwrite detected drift and makes discrepancies visible', async () => {
        const item = await product(5)
        const { adapter } = commerce.mongoCommerce(payload)
        await adapter.collections.products.updateOne(
          { _id: item.id },
          { $set: { 'variants.0.stock': 20 } },
        )
        await expect(adjust(item.id, 30)).rejects.toThrow('Reconciliation')
        expect(await stock(item.id)).toBe(20)
        expect((await activity.operationsStatus(payload, admin)).driftedVariants).toBe(1)
        await expect(operations.captureInventoryBaselines(payload, admin)).rejects.toThrow(
          'Reconciliation',
        )
      })
      it('preserves first milestones and snapshots after rename, repricing, cancellation and deletion', async () => {
        const item = await product(5),
          result = await purchase(input(item.id))
        if (!('orderId' in result)) throw new Error('Missing order')
        await payload.update({
          collection: 'products',
          id: item.id,
          data: { title: 'Later product name' },
          context: { skipShoppableVideoSync: true },
        })
        await commerce.commerceTransaction(payload, admin, (req) =>
          payload.update({
            collection: 'orders',
            id: result.orderId,
            req,
            data: { items: [{ product: item.id, variantSize: 'M', quantity: 1, unitPrice: 1200 }] },
          }),
        )
        await status(result.orderId, 'cancelled')
        await payload.delete({ collection: 'orders', id: result.orderId })
        const state = await collection('milestones').findOne({ _id: String(result.orderId) })
        expect(state?.firstConfirmedValue).toBe(1350)
        expect(state?.creationItems[0].title).toBe('Test suit')
        const report = await activity.operationsReport(
          payload,
          admin,
          new URLSearchParams({ source: 'milestones' }),
        )
        expect(report.summary.confirmedValue).toBe(1350)
        expect(report.rows[0]).toMatchObject({ deleted: true, value: 1350 })
        expect(JSON.stringify(report)).not.toMatch(/test@example|030011|Synthetic test address/)
      })
      it('concurrent stock writers maintain one continuous stable-ID ledger', async () => {
        const item = await product(5)
        await Promise.all([adjust(item.id, 20), adjust(item.id, 30)])
        const balance = await collection('balances').findOne({ productId: String(item.id) })
        expect(balance?.stock).toBe(await stock(item.id))
        const ledger = await collection('stock')
          .find({ productId: String(item.id) })
          .sort({ sequence: 1 })
          .toArray()
        for (let index = 1; index < ledger.length; index++)
          expect(ledger[index].before).toBe(ledger[index - 1].after)
        expect(ledger.reduce((sum, value) => sum + value.delta, ledger[0].after)).toBe(
          balance?.stock,
        )
      })
      it('records first shipping/delivery dates without erasing earlier milestones', async () => {
        const item = await product(5),
          result = await purchase(input(item.id))
        if (!('orderId' in result)) throw new Error('Missing order')
        const move = (next: 'shipped' | 'delivered') =>
          commerce.commerceTransaction(payload, admin, (req) =>
            payload.update({
              collection: 'orders',
              id: result.orderId,
              req,
              data: { status: next },
            }),
          )
        await move('shipped')
        await move('delivered')
        const first = await collection('milestones').findOne({ _id: String(result.orderId) })
        expect(first?.firstShippedAt).toBeInstanceOf(Date)
        expect(first?.firstDeliveredAt).toBeInstanceOf(Date)
        await status(result.orderId, 'cancelled')
        await status(result.orderId, 'confirmed')
        await move('shipped')
        await move('delivered')
        const latest = await collection('milestones').findOne({ _id: String(result.orderId) })
        expect(latest?.firstShippedAt).toEqual(first?.firstShippedAt)
        expect(latest?.firstDeliveredAt).toEqual(first?.firstDeliveredAt)
      })
      it('history pagination and audited CSV include all matching safe records', async () => {
        const item = await product(5)
        for (let index = 6; index <= 56; index++) await adjust(item.id, index)
        const query = new URLSearchParams({ source: 'stock', productId: String(item.id) })
        const normal = await activity.operationsReport(payload, admin, query)
        expect(normal.rows).toHaveLength(50)
        expect(normal.pagination.totalRows).toBe(53)
        query.set('format', 'csv')
        const exported = await activity.operationsReport(payload, admin, query)
        expect(exported.rows).toHaveLength(53)
        const csv = await activity.operationsCSV(payload, admin, exported)
        expect(csv.trim().split('\r\n')).toHaveLength(54)
        expect(csv).not.toMatch(/customer|test@example|030011|Synthetic test address|receipt/i)
        expect(await collection('audit').countDocuments()).toBe(1)
      })
    })
  },
)
