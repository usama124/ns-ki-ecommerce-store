import { attachDatabasePool } from '@vercel/functions'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { getDatabaseOptions } from './databaseOptions'

type MongoClient = ReturnType<MongooseAdapter['connection']['getClient']>
type Diagnostic = {
  event: 'client_observed' | 'pool_events' | 'checkout_failed' | 'lifecycle_attach_failed'
  instance: string
  appName: string
  lifecycleAttached: boolean
  maxPoolSize: number
  minPoolSize: number
  maxIdleTimeMS: number
  observedEvents: Record<string, number>
}
type Report = (diagnostic: Diagnostic) => void
type State = {
  instance: string
  attached: boolean
  diagnostics: boolean
  lastReport: number
  lastFailure: number
  counts: Record<string, number>
}

// Share registration across repeated getPayload calls and module/HMR reloads.
// Weak keys do not keep destroyed clients alive. This is NOT another client cache.
const registryKey = Symbol.for('nski.mongo-pool-lifecycle.v1')
const runtime = globalThis as typeof globalThis & { [registryKey]?: WeakMap<object, State> }
const clients = runtime[registryKey] ||= new WeakMap<object, State>()

const defaultReport: Report = diagnostic => {
  const line = `[mongo-pool] ${JSON.stringify(diagnostic)}`
  if (diagnostic.event.endsWith('failed')) console.warn(line)
  else console.info(line)
}

/** Register the existing driver client; never connect, close, or replace it. */
export function configureMongoPool(
  client: MongoClient,
  env: Record<string, string | undefined> = process.env,
  report: Report = defaultReport,
) {
  let state = clients.get(client)
  if (!state) {
    state = { instance: randomUUID(), attached: false, diagnostics: false, lastReport: 0, lastFailure: -Infinity, counts: {} }
    clients.set(client, state)
  }
  const current = state
  const options = getDatabaseOptions(env).mongo
  const emit = (event: Diagnostic['event']) => {
    try {
      report({
        event,
        instance: current.instance,
        appName: options.appName,
        lifecycleAttached: current.attached,
        maxPoolSize: client.options.maxPoolSize,
        minPoolSize: client.options.minPoolSize,
        maxIdleTimeMS: client.options.maxIdleTimeMS,
        observedEvents: { ...current.counts },
      })
    } catch {
      // Optional diagnostic reporting must never break a MongoDB operation.
    }
  }
  // Vercel does not expose REGION in builds; CLI/local processes must not attach
  // request-lifetime work. The SDK listens to checkouts, keeping the invocation
  // alive long enough for the driver's own idle expiry to run before suspension.
  if (env.VERCEL === '1' && env.VERCEL_REGION && env.VERCEL_URL && !current.attached) {
    try {
      attachDatabasePool(client)
      current.attached = true
    } catch {
      // Keep the bounded driver pool usable; expose a sanitized actionable signal.
      emit('lifecycle_attach_failed')
    }
  }
  if (env.DB_POOL_DIAGNOSTICS !== 'true' || current.diagnostics) return
  current.diagnostics = true
  current.lastReport = Date.now()
  emit('client_observed')
  const events = [
    'connectionPoolCreated', 'connectionPoolClosed', 'connectionPoolCleared',
    'connectionCreated', 'connectionClosed', 'connectionCheckOutFailed',
  ] as const
  for (const event of events) {
    // Do not collect driver event payloads: they can include hosts/errors.
    client.on(event, () => {
      current.counts[event] = (current.counts[event] || 0) + 1
      const now = Date.now()
      if (event === 'connectionCheckOutFailed' && now - current.lastFailure >= 30000) {
        current.lastFailure = now
        emit('checkout_failed')
      } else if (now - current.lastReport >= 10000) {
        current.lastReport = now
        emit('pool_events')
      }
    })
  }
}

export const afterOpenMongoConnection: NonNullable<MongooseAdapter['afterOpenConnection']> = adapter => {
  configureMongoPool(adapter.connection.getClient())
}
