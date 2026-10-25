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
  },
)
