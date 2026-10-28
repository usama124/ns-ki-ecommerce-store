import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { ClientSession, Db, Document } from 'mongodb'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import type { User } from '@/payload-types'
import { randomInt, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { RequestError } from './apiSecurity'

export const COMMERCE = {
  config: 'nski_commerce_config',
  checkout: 'nski_checkout_requests',
  movements: 'nski_stock_movements',
  outbox: 'nski_email_outbox',
  limits: 'nski_request_limits',
} as const
export type InternalRecord = Document & { _id: string }
// Multiple installed adapter module augmentations intersect `sessions`; narrow
// it to the adapter actually checked at runtime rather than a SQL session shape.
type CommerceAdapter = Omit<MongooseAdapter, 'sessions'> & {
  sessions: Record<string | number, ClientSession>
}

export function mongoCommerce(payload: Payload) {
  const adapter = payload.db as unknown as CommerceAdapter
  if (adapter.name !== 'mongoose' || !adapter.connection?.db || !adapter.transactionOptions)
    throw new RequestError(
      'Commerce requires transaction-enabled MongoDB. Please contact the store.',
      503,
    )
  return { adapter, db: adapter.connection.db as Db }
}

export async function requireCommerceReady(payload: Payload) {
  const mongo = mongoCommerce(payload)
  const ready = await mongo.db
    .collection<InternalRecord>(COMMERCE.config)
    .findOne({ _id: 'v1', ready: true })
  if (!ready)
    throw new RequestError('Commerce storage needs initialization. Please contact the store.', 503)
  return mongo
}

export async function commerceSession(req: PayloadRequest): Promise<ClientSession> {
  const { adapter } = mongoCommerce(req.payload)
  const id = await req.transactionID
  const session = id && adapter.sessions[id]
  if (!session || !session.inTransaction())
    throw new RequestError('A verified inventory transaction is required.', 503)
  return session
}

const labeled = (error: unknown, label: string) =>
  Boolean((error as { hasErrorLabel?: (label: string) => boolean })?.hasErrorLabel?.(label))
const transient = (error: unknown) =>
  labeled(error, 'TransientTransactionError') ||
  [112, 244, 251].includes((error as { code?: number })?.code || 0)
const numberCollision = (error: unknown) =>
  (error as { data?: { errors?: Array<{ path?: string }> } })?.data?.errors?.some(
    (field) => field.path === 'orderNumber',
  )

/** Own the session/commit so ambiguous commits never re-run a purchase body. */
export async function commerceTransaction<T>(
  payload: Payload,
  user: User | null | undefined,
  work: (req: PayloadRequest) => Promise<T>,
  retryDuplicate = false,
): Promise<T> {
  const { adapter } = await requireCommerceReady(payload)
  for (let attempt = 0; attempt < 4; attempt++) {
    // Let a competing transaction commit instead of exhausting all retry slots
    // immediately while it still owns the same checkout/stock document.
    if (attempt) await delay(50 * 2 ** (attempt - 1) + randomInt(25))
    const session = adapter.connection.getClient().startSession()
    const id = randomUUID()
    adapter.sessions[id] = session
    let committing = false
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: 5000,
      })
      const req = await createLocalReq(
        { user: user || undefined, context: { skipShoppableVideoSync: true } },
        payload,
      )
      req.transactionID = id
      const result = await work(req)
      committing = true
      for (let commit = 0; ; commit++) {
        try {
          await session.commitTransaction()
          return result
        } catch (error) {
          if (labeled(error, 'UnknownTransactionCommitResult') && commit < 2) continue
          throw error
        }
      }
    } catch (error) {
      // An uncertain commit must be recovered by the durable idempotency record
      // on the next request, never by starting a fresh purchase here.
      if (
        !committing &&
        attempt < 3 &&
        (transient(error) ||
          (retryDuplicate &&
            ((error as { code?: number })?.code === 11000 || numberCollision(error))))
      )
        continue
      throw error
    } finally {
      delete adapter.sessions[id]
      if (session.inTransaction()) {
        try {
          await session.abortTransaction()
        } catch {
          /* ambiguous/aborted already */
        }
      }
      await session.endSession()
    }
  }
  throw new RequestError(
    'The order could not be completed. Retry with the same checkout details.',
    503,
  )
}

/** Explicit deployment step, not automatic DDL on customer requests. */
export async function initializeCommerce(payload: Payload) {
  const { db, adapter } = mongoCommerce(payload)
  for (const name of Object.values(COMMERCE)) {
    if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext()))
      await db.createCollection(name)
  }
  await db
    .collection<InternalRecord>(COMMERCE.config)
    .updateOne({ _id: 'v1' }, { $set: { ready: false } }, { upsert: true })
  const orderCollection = adapter.collections.orders.collection
  const indexes = await orderCollection.indexes()
  if (
    !indexes.some(
      (index) => index.unique && index.key.orderNumber === 1 && Object.keys(index.key).length === 1,
    )
  )
    await orderCollection.createIndex(
      { orderNumber: 1 },
      {
        unique: true,
        name: 'commerce_order_number_unique',
        partialFilterExpression: { orderNumber: { $type: 'string' } },
      },
    )
  if (
    !indexes.some(
      (index) =>
        index.unique && index.key.compositeTrxKey === 1 && Object.keys(index.key).length === 1,
    )
  )
    await orderCollection.createIndex(
      { compositeTrxKey: 1 },
      {
        unique: true,
        name: 'commerce_transfer_reference_unique',
        partialFilterExpression: { compositeTrxKey: { $type: 'string' } },
      },
    )
  await db.collection(COMMERCE.limits).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection(COMMERCE.outbox).createIndex({ state: 1, availableAt: 1 })
  await db.collection(COMMERCE.movements).createIndex({ orderId: 1, createdAt: 1 })
  // Force a real transactional round trip; a started client session alone is not proof.
  const session = adapter.connection.getClient().startSession()
  try {
    session.startTransaction()
    await db
      .collection<InternalRecord>(COMMERCE.config)
      .updateOne(
        { _id: 'transaction-probe' },
        { $set: { checkedAt: new Date() } },
        { upsert: true, session },
      )
    await session.abortTransaction()
  } finally {
    await session.endSession()
  }
  await db
    .collection<InternalRecord>(COMMERCE.config)
    .updateOne(
      { _id: 'v1' },
      { $set: { ready: true, initializedAt: new Date() } },
      { upsert: true },
    )
}
