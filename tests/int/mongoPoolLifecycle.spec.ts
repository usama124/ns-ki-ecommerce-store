// @vitest-environment node
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
const sdk = vi.hoisted(() => ({ attach: vi.fn() }))
vi.mock('@vercel/functions', () => ({ attachDatabasePool: sdk.attach }))
import { afterOpenMongoConnection, configureMongoPool } from '@/utilities/mongoPoolLifecycle'
import { getDatabaseOptions } from '@/utilities/databaseOptions'

const preview = { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_REGION: 'iad1', VERCEL_URL: 'preview.example.invalid', DB_POOL_MAX: '10' }
function fakeClient() {
  return Object.assign(new EventEmitter(), { options: getDatabaseOptions(preview).mongo }) as unknown as Parameters<typeof configureMongoPool>[0]
}
function emit(client: ReturnType<typeof fakeClient>, event: string, payload: unknown) {
  // Inject arbitrary synthetic metadata to verify that logs never serialize it.
  ;(client as unknown as EventEmitter).emit(event, payload)
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); sdk.attach.mockReset() })

describe('per-instance MongoDB budgets', () => {
  it('limits the existing preview DB_POOL_MAX=10 setting to two unless explicitly overridden for preview', () => {
    expect(getDatabaseOptions(preview).mongo).toMatchObject({ maxPoolSize: 2, minPoolSize: 0, maxConnecting: 1, maxIdleTimeMS: 10000 })
    expect(getDatabaseOptions({ ...preview, DB_POOL_MAX_PREVIEW: '3' }).mongo.maxPoolSize).toBe(3)
    expect(getDatabaseOptions({ ...preview, DB_POOL_MAX: '1' }).mongo.maxPoolSize).toBe(1)
    expect(getDatabaseOptions({ ...preview, DB_POOL_MAX_PREVIEW: 'invalid' }).mongo.maxPoolSize).toBe(2)
    expect(getDatabaseOptions({ ...preview, DB_POOL_MAX_PREVIEW: '0' }).mongo.maxPoolSize).toBe(2)
    expect(getDatabaseOptions({ ...preview, DB_POOL_MAX_PREVIEW: '-1' }).mongo.maxPoolSize).toBe(2)
  })
  it('preserves production overrides and PostgreSQL behavior', () => {
    expect(getDatabaseOptions({ ...preview, VERCEL_ENV: 'production' }).mongo.maxPoolSize).toBe(10)
    expect(getDatabaseOptions({ VERCEL: '1', VERCEL_ENV: 'production' }).mongo.maxPoolSize).toBe(5)
    expect(getDatabaseOptions({ ...preview, DB_POOL_MAX_PREVIEW: '1' }).postgres.max).toBe(10)
    expect(getDatabaseOptions({ DB_POOL_MAX_PREVIEW: '1' }).postgres.max).toBe(5)
  })
  it('keeps bounded waits and idle expiry with validated overrides', () => {
    expect(getDatabaseOptions({ ...preview, DB_MAX_IDLE_TIME_MS: '5000', DB_CONNECT_TIMEOUT_MS: '7000' }).mongo).toMatchObject({ maxIdleTimeMS: 5000, connectTimeoutMS: 7000, serverSelectionTimeoutMS: 7000, waitQueueTimeoutMS: 7000 })
    for (const value of ['0', '-1', 'NaN', 'Infinity', '1.5']) {
      expect(getDatabaseOptions({ ...preview, DB_MAX_IDLE_TIME_MS: value }).mongo.maxIdleTimeMS).toBe(10000)
    }
    expect(getDatabaseOptions({}).mongo).toMatchObject({ minPoolSize: 0, maxPoolSize: 5, maxConnecting: 2, maxIdleTimeMS: 30000 })
  })
  it('adds a bounded deployment label without including URLs or database credentials', () => {
    expect(getDatabaseOptions({ ...preview, VERCEL_DEPLOYMENT_ID: 'dpl_ABC123' }).mongo.appName).toBe('nski-preview-dpl_ABC123')
    expect(getDatabaseOptions({ ...preview, DATABASE_URL: 'mongodb://secret:password@host/db' }).mongo.appName).toBe('nski-preview')
    expect(getDatabaseOptions({ ...preview, VERCEL_DEPLOYMENT_ID: 'x'.repeat(500) }).mongo.appName.length).toBeLessThan(80)
  })
})

describe('existing-client lifecycle registration', () => {
  it('attaches exactly once per actual client, including concurrent-looking repeated hooks', () => {
    const client = fakeClient()
    configureMongoPool(client, preview)
    configureMongoPool(client, preview)
    expect(sdk.attach).toHaveBeenCalledTimes(1)
    expect(sdk.attach).toHaveBeenCalledWith(client)
    configureMongoPool(fakeClient(), preview)
    expect(sdk.attach).toHaveBeenCalledTimes(2)
  })
  it.each([{}, { VERCEL: '1', VERCEL_URL: 'build.example' }, { VERCEL: '1', VERCEL_REGION: 'iad1' }])('does not attach request-lifetime work in local/build/CLI environment %s', env => {
    configureMongoPool(fakeClient(), env)
    expect(sdk.attach).not.toHaveBeenCalled()
  })
  it('attaches if a previously observed local client later runs in the Vercel runtime', () => {
    const client = fakeClient()
    configureMongoPool(client, {})
    configureMongoPool(client, preview)
    expect(sdk.attach).toHaveBeenCalledTimes(1)
  })
  it('uses the existing Payload client, without creating or closing connections', () => {
    for (const [key, value] of Object.entries(preview)) vi.stubEnv(key, value)
    const client = fakeClient()
    const getClient = vi.fn(() => client)
    afterOpenMongoConnection({ connection: { getClient } } as never)
    afterOpenMongoConnection({ connection: { getClient } } as never)
    expect(getClient).toHaveBeenCalledTimes(2)
    expect(sdk.attach).toHaveBeenCalledOnce()
  })
  it('reports a sanitized failure without breaking the usable driver pool, and permits a retry', () => {
    sdk.attach.mockImplementationOnce(() => { throw new Error('mongodb://secret:password@internal') })
    const report = vi.fn(), client = fakeClient()
    expect(() => configureMongoPool(client, preview, report)).not.toThrow()
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ event: 'lifecycle_attach_failed', lifecycleAttached: false }))
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/password|internal|mongodb:\/\//)
    configureMongoPool(client, preview, report)
    expect(sdk.attach).toHaveBeenCalledTimes(2)
  })
})

describe('opt-in diagnostics', () => {
  it('stays silent by default and installs no diagnostic listeners', () => {
    const client = fakeClient(), report = vi.fn()
    configureMongoPool(client, {}, report)
    expect(report).not.toHaveBeenCalled()
    expect(client.listenerCount('connectionCreated')).toBe(0)
  })
  it('labels and throttles event counts without logging event payloads or registering twice', () => {
    let time = 100000
    vi.spyOn(Date, 'now').mockImplementation(() => time)
    const report = vi.fn(), client = fakeClient()
    const env = { ...preview, DB_POOL_DIAGNOSTICS: 'true' }
    configureMongoPool(client, env, report)
    configureMongoPool(client, env, report)
    expect(client.listenerCount('connectionCreated')).toBe(1)
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'client_observed', lifecycleAttached: true, maxPoolSize: 2 }))
    emit(client, 'connectionCreated', { address: 'secret-host', error: 'private error' })
    expect(report).toHaveBeenCalledTimes(1)
    time += 10000
    emit(client, 'connectionClosed', { address: 'secret-host' })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'pool_events', observedEvents: { connectionCreated: 1, connectionClosed: 1 } }))
    emit(client, 'connectionCheckOutFailed', { error: 'password' })
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'checkout_failed' }))
    emit(client, 'connectionCheckOutFailed', { error: 'password' })
    expect(report).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/secret-host|private error|password/)
  })
  it('contains logger exceptions inside driver event handlers', () => {
    const client = fakeClient(), report = () => { throw new Error('logger unavailable') }
    expect(() => configureMongoPool(client, { DB_POOL_DIAGNOSTICS: 'true' }, report)).not.toThrow()
    expect(() => emit(client, 'connectionCheckOutFailed', {})).not.toThrow()
  })
})
