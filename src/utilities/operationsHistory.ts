import type { Payload, PayloadRequest } from 'payload'
import { randomUUID } from 'node:crypto'
import type { Order, Product, User } from '@/payload-types'
import { checkRole } from '@/access/utilities'
import { RequestError } from './apiSecurity'
import {
  COMMERCE,
  commerceSession,
  commerceTransaction,
  mongoCommerce,
  requireCommerceReady,
  type InternalRecord,
} from './commerceDatabase'

export const OPERATIONS = {
  history: 'nski_order_history',
  milestones: 'nski_order_milestones',
  stock: 'nski_inventory_ledger',
  balances: 'nski_inventory_balances',
  audit: 'nski_operations_exports',
} as const
export function requireOperationsAdmin(user: User | null | undefined) {
  if (!checkRole(['admin'], user)) throw new RequestError('Action forbidden.', 403)
}
/** Readiness is cached only in this trusted request, never globally across tenants. */
export async function operationsEnabled(req: PayloadRequest) {
  req.context ||= {}
  if (typeof req.context.operationsReady === 'boolean') return req.context.operationsReady
  if (req.payload.db.name !== 'mongoose') return false
  const ready = await mongoCommerce(req.payload)
    .db.collection<InternalRecord>(COMMERCE.config)
    .findOne(
      { _id: 'operations-v1', ready: true },
      { session: (await req.transactionID) ? await commerceSession(req) : undefined },
    )
  req.context.operationsReady = Boolean(ready)
  return Boolean(ready)
}
export async function initializeOperations(payload: Payload, user: User) {
  requireOperationsAdmin(user)
  const { db } = await requireCommerceReady(payload)
  for (const name of Object.values(OPERATIONS))
    if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext()))
      await db.createCollection(name)
  await db.collection(OPERATIONS.history).createIndex({ recordedAt: 1, orderId: 1 })
  await db.collection(OPERATIONS.stock).createIndex({ recordedAt: 1, productId: 1, variantId: 1 })
  await db.collection(OPERATIONS.milestones).createIndex({ firstConfirmedAt: 1 })
  await db.collection(OPERATIONS.balances).createIndex({ active: 1 })
  await db.collection(OPERATIONS.audit).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection<InternalRecord>(COMMERCE.config).updateOne(
    { _id: 'operations-v1' },
    {
      $setOnInsert: { coverageStartedAt: new Date() },
      $set: { ready: true },
    },
    { upsert: true },
  )
}

type Variant = NonNullable<Product['variants']>[number]
function stockOf(variant: Variant) {
  if (
    !variant.id ||
    !Number.isSafeInteger(variant.stock) ||
    variant.stock! < 0 ||
    variant.stock! > 1000000
  )
    throw new RequestError(
      'A stable variant ID and valid stock are required for inventory history.',
      409,
    )
  return variant.stock!
}
function variantMetadata(product: Product, variant: Variant) {
  return {
    title: product.title.slice(0, 200),
    sku: (variant.sku || '').slice(0, 120),
    sizeId: String(typeof variant.size === 'object' ? variant.size.id : variant.size),
  }
}
async function ensureBalance(
  product: Product,
  variant: Variant,
  stock: number,
  req: PayloadRequest,
) {
  const session = await commerceSession(req),
    { db } = mongoCommerce(req.payload)
  const id = `${product.id}:${variant.id}`
  let balance = await db
    .collection<InternalRecord>(OPERATIONS.balances)
    .findOne({ _id: id }, { session })
  if (!balance) {
    const now = new Date()
    balance = {
      _id: id,
      productId: String(product.id),
      variantId: String(variant.id),
      sequence: 0,
      stock,
      active: true,
      baselineAt: now,
    }
    await db.collection<InternalRecord>(OPERATIONS.balances).insertOne(balance, { session })
    await db.collection<InternalRecord>(OPERATIONS.stock).insertOne(
      {
        _id: `${id}:0`,
        productId: String(product.id),
        variantId: String(variant.id),
        sequence: 0,
        kind: 'opening_balance',
        before: null,
        after: stock,
        delta: 0,
        recordedAt: now,
        actorId: req.user ? String(req.user.id) : null,
        ...variantMetadata(product, variant),
      },
      { session },
    )
  }
  return balance
}

/** Every allowed product write (REST/GraphQL/Local API) passes through this hook. */
export async function recordProductStock(
  doc: Product,
  previous: Product | undefined,
  req: PayloadRequest,
  deleted = false,
) {
  if (!(await operationsEnabled(req))) return
  const session = await commerceSession(req),
    { db } = mongoCommerce(req.payload)
  const before = new Map((previous?.variants || []).map((value) => [String(value.id), value]))
  const after = new Map(
    (deleted ? [] : doc.variants || []).map((value) => [String(value.id), value]),
  )
  const changed = new Set([...before.keys(), ...after.keys()])
  for (const variantId of changed) {
    const old = before.get(variantId),
      next = after.get(variantId),
      variant = next || old!
    const priorStock = old ? stockOf(old) : 0,
      nextStock = next ? stockOf(next) : 0
    const balance = await ensureBalance(previous || doc, old || variant, priorStock, req)
    if (!balance.active || balance.stock !== priorStock)
      throw new RequestError(
        'Inventory ledger does not match stock. Reconciliation is required.',
        409,
      )
    if (old && next && priorStock === nextStock) continue
    const sequence = balance.sequence + 1
    const reason =
      typeof req.context.stockReason === 'string' &&
      [
        'order_allocation',
        'order_restore',
        'restock',
        'damage',
        'correction',
        'manual_adjustment',
      ].includes(req.context.stockReason)
        ? req.context.stockReason
        : 'product_change'
    const eventId = `${doc.id}:${variantId}:${sequence}`
    await db.collection<InternalRecord>(OPERATIONS.stock).insertOne(
      {
        _id: eventId,
        productId: String(doc.id),
        variantId,
        sequence,
        kind: deleted
          ? 'product_deleted'
          : !next
            ? 'variant_removed'
            : !old
              ? 'variant_created'
              : reason,
        before: priorStock,
        after: nextStock,
        delta: nextStock - priorStock,
        recordedAt: new Date(),
        actorId: req.user ? String(req.user.id) : null,
        ...variantMetadata(doc, variant),
      },
      { session },
    )
    await db.collection<InternalRecord>(OPERATIONS.balances).updateOne(
      { _id: balance._id },
      {
        $set: { sequence, stock: nextStock, active: Boolean(next), lastChangedAt: new Date() },
      },
      { session },
    )
    if (reason === 'order_allocation' || reason === 'order_restore') {
      const pending = (req.context.orderStockEvents as string[] | undefined) || []
      req.context.orderStockEvents = [...pending, eventId]
    }
  }
}

/** Populate missing baselines in bounded, resumable transactions. Repeats do not reset them. */
export async function captureInventoryBaselines(payload: Payload, user: User, cursor = '') {
  requireOperationsAdmin(user)
  const result = await payload.find({
    collection: 'products',
    user,
    overrideAccess: false,
    depth: 0,
    sort: 'id',
    limit: 25,
    where: cursor ? { id: { greater_than: cursor } } : undefined,
    select: { title: true, variants: true },
  })
  for (const product of result.docs)
    await commerceTransaction(
      payload,
      user,
      async (req) => {
        if (!(await operationsEnabled(req)))
          throw new RequestError('Initialize operations tracking first.', 503)
        const current = await payload.findByID({
          collection: 'products',
          id: product.id,
          req,
          user,
          overrideAccess: false,
          depth: 0,
        })
        // A real write fence makes the opening snapshot conflict with concurrent
        // product writers, including requests that began before tracking activation.
        // Both set/unset are in this transaction: no content/timestamp change persists.
        const { adapter } = mongoCommerce(payload)
        const collection = adapter.collections.products.collection
        const productKey = adapter.collections.products.schema.path('_id').cast(current.id)
        const session = await commerceSession(req)
        if (
          await collection.findOne(
            { _id: productKey, __nskiBaselineFence: { $exists: true } },
            { session },
          )
        )
          throw new RequestError(
            'Baseline lock field conflicts with existing data. Review this product before continuing.',
            409,
          )
        await collection.updateOne(
          { _id: productKey },
          { $set: { __nskiBaselineFence: randomUUID() } },
          { session },
        )
        for (const variant of current.variants || []) {
          const stock = stockOf(variant)
          const balance = await ensureBalance(current, variant, stock, req)
          if (!balance.active || balance.stock !== stock)
            throw new RequestError(
              'Inventory ledger does not match current stock. Reconciliation is required.',
              409,
            )
        }
        await collection.updateOne(
          { _id: productKey },
          { $unset: { __nskiBaselineFence: '' } },
          { session },
        )
      },
      true,
    )
  return {
    processed: result.docs.length,
    nextCursor: result.hasNextPage ? String(result.docs.at(-1)!.id) : null,
  }
}

const idOf = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value ? String(value.id) : String(value || '')
function orderSignature(order: Order) {
  return JSON.stringify([
    order.status,
    order.items?.map((line) => [
      idOf(line.product),
      line.variantSize,
      line.variantSku,
      line.quantity,
      line.unitPrice,
    ]),
    order.totalAmount,
    order.subtotal,
    order.shippingFee,
    order.codFee,
    order.paymentMethod,
    order.fulfillment,
  ])
}
/** Immutable post-validation snapshots; never customer/contact/proof/free-form notes. */
export async function recordOrderHistory(
  doc: Order,
  previous: Order | undefined,
  operation: string,
  req: PayloadRequest,
  deleted = false,
) {
  if (!(await operationsEnabled(req))) return
  const session = await commerceSession(req),
    { db } = mongoCommerce(req.payload)
  const pending = req.context.orderStockEvents as string[] | undefined
  if (pending?.length) {
    await db
      .collection<InternalRecord>(OPERATIONS.stock)
      .updateMany({ _id: { $in: pending } }, { $set: { orderId: String(doc.id) } }, { session })
    req.context.orderStockEvents = []
  }
  if (!deleted && previous && orderSignature(doc) === orderSignature(previous)) return
  const states = db.collection<InternalRecord>(OPERATIONS.milestones)
  const prior = await states.findOne({ _id: String(doc.id) }, { session })
  const now = new Date(),
    sequence = (prior?.sequence || 0) + 1
  const patch: Record<string, unknown> = {
    sequence,
    currentStatus: doc.status,
    deleted,
    lastObservedAt: now,
  }
  const complete = operation === 'create' || prior?.coverage === 'since_creation'
  if (
    complete &&
    !deleted &&
    ['confirmed', 'processing'].includes(doc.status || '') &&
    !prior?.firstConfirmedAt &&
    (operation === 'create' || !['confirmed', 'processing'].includes(previous?.status || ''))
  ) {
    patch.firstConfirmedAt = now
    patch.firstConfirmedValue = doc.totalAmount
  }
  if (
    complete &&
    !deleted &&
    doc.status === 'shipped' &&
    !prior?.firstShippedAt &&
    (operation === 'create' || previous?.status !== 'shipped')
  )
    patch.firstShippedAt = now
  if (
    complete &&
    !deleted &&
    doc.status === 'delivered' &&
    !prior?.firstDeliveredAt &&
    (operation === 'create' || previous?.status !== 'delivered')
  )
    patch.firstDeliveredAt = now
  const products =
    operation === 'create'
      ? await req.payload.find({
          collection: 'products',
          req,
          overrideAccess: true,
          depth: 0,
          limit: 50,
          where: { id: { in: [...new Set((doc.items || []).map((line) => idOf(line.product)))] } },
          select: { title: true, primaryCategory: true, variants: true },
        })
      : undefined
  const items = (doc.items || []).map((line) => {
    const product = products?.docs.find((product) => String(product.id) === idOf(line.product))
    return {
      productId: idOf(line.product),
      size: line.variantSize.slice(0, 100),
      sku: (line.variantSku || '').slice(0, 120),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      ...(product
        ? {
            title: product.title.slice(0, 200),
            primaryCategoryId: idOf(product.primaryCategory),
            variantId:
              product.variants?.find((v) => v.sku && v.sku === line.variantSku)?.id || null,
          }
        : {}),
    }
  })
  await states.updateOne(
    { _id: String(doc.id) },
    {
      $set: patch,
      $setOnInsert: {
        orderNumber: doc.orderNumber.slice(0, 80),
        firstObservedAt: now,
        coverage: operation === 'create' ? 'since_creation' : 'partial_legacy',
        ...(operation === 'create' ? { placedAt: now, creationItems: items } : {}),
      },
    },
    { upsert: true, session },
  )
  const state = doc.inventoryState as
    { allocations?: { quantity: number; deducted: number; backordered: number }[] } | undefined
  await db.collection<InternalRecord>(OPERATIONS.history).insertOne(
    {
      _id: `${doc.id}:${sequence}`,
      orderId: String(doc.id),
      orderNumber: doc.orderNumber.slice(0, 80),
      sequence,
      kind: deleted
        ? 'order_deleted'
        : operation === 'create'
          ? 'order_created'
          : previous?.status !== doc.status
            ? 'status_changed'
            : 'order_changed',
      fromStatus: previous?.status || null,
      toStatus: doc.status,
      recordedAt: now,
      actorId: req.user ? String(req.user.id) : null,
      total: doc.totalAmount,
      subtotal: doc.subtotal,
      shippingFee: doc.shippingFee,
      codFee: doc.codFee || 0,
      paymentMethod: doc.paymentMethod,
      courier: doc.fulfillment?.courierName || null,
      items,
      requestedUnits: (state?.allocations || []).reduce((sum, entry) => sum + entry.quantity, 0),
      deductedUnits: (state?.allocations || []).reduce((sum, entry) => sum + entry.deducted, 0),
      backorderedUnits: (state?.allocations || []).reduce(
        (sum, entry) => sum + entry.backordered,
        0,
      ),
    },
    { session },
  )
}
