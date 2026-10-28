/** Disposable localhost-only smoke test. Never reads .env or a remote DB URL. */
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

if (!process.argv.includes('--local-pool-check')) {
  throw new Error('Explicit --local-pool-check required; see docs/mongodb-connection-management.md')
}
process.env = {
  PATH: process.env.PATH,
  NODE_ENV: 'test',
  DB_ADAPTER: 'mongodb',
  DATABASE_URL: 'mongodb://127.0.0.1:27148/nski_pool_smoke?replicaSet=rs0&directConnection=true',
  PAYLOAD_SECRET: 'isolated-local-pool-smoke-test-only',
  VERCEL_ENV: 'preview',
  DB_POOL_MAX: '10',
  DB_MAX_IDLE_TIME_MS: '250',
}
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { mongoCommerce } = await import('../src/utilities/commerceDatabase')
const isolatedConfig = await config
isolatedConfig.typescript.autoGenerate = false
const payloads = await Promise.all(Array.from({ length: 12 }, () => getPayload({ config: isolatedConfig })))
const payload = payloads[0]
try {
  assert.equal(new Set(payloads).size, 1, 'concurrent getPayload must reuse one instance')
  const { adapter, db } = mongoCommerce(payload)
  const client = adapter.connection.getClient()
  assert.equal(client.options.maxPoolSize, 2)
  assert.equal(client.options.minPoolSize, 0)
  assert.equal(client.options.maxConnecting, 1)
  let inUse = 0, peakInUse = 0, closed = 0
  client.on('connectionCheckedOut', () => { inUse++; peakInUse = Math.max(inUse, peakInUse) })
  client.on('connectionCheckedIn', () => { inUse-- })
  client.on('connectionClosed', () => { closed++ })
  await Promise.all(Array.from({ length: 24 }, () => db.command({ ping: 1 })))
  assert(peakInUse > 0 && peakInUse <= 2, `unexpected pool use: ${peakInUse}`)
  const session = client.startSession()
  try {
    session.startTransaction()
    await db.collection('pool_transaction_probe').insertOne({ probe: true }, { session })
    await session.abortTransaction()
  } finally { await session.endSession() }
  assert.equal(await db.collection('pool_transaction_probe').countDocuments({}), 0, 'transaction rollback must remain intact')
  for (let attempt = 0; closed === 0 && attempt < 10; attempt++) await delay(500)
  assert(closed > 0, 'idle application connections should close')
  await db.command({ ping: 1 })
  assert.equal((await getPayload({ config: isolatedConfig })).db, payload.db, 'pool must remain reusable after idle expiry')
  console.log(JSON.stringify({ result: 'passed', payloadInstances: 1, concurrentPings: 24, maxPoolSize: client.options.maxPoolSize, peakCheckedOut: peakInUse, idleConnectionClosuresObserved: closed, transactionRolledBack: true, reusableAfterIdle: true }))
} finally {
  await payload.destroy()
}
