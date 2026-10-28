// @vitest-environment node
import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { configureMongoPool } from '@/utilities/mongoPoolLifecycle'

it('the real pinned Vercel SDK extends the request through MongoDB idle expiry without closing the client', async () => {
  const key = Symbol.for('@vercel/request-context')
  const previous = Object.getOwnPropertyDescriptor(globalThis, key)
  const waitUntil = vi.fn()
  vi.useFakeTimers()
  vi.stubEnv('VERCEL_URL', 'preview.example.invalid')
  vi.stubEnv('VERCEL_REGION', 'iad1')
  Object.defineProperty(globalThis, key, { configurable: true, value: { get: () => ({ waitUntil }) } })
  try {
    const client = Object.assign(new EventEmitter(), {
      options: { maxIdleTimeMS: 250, minPoolSize: 0, maxPoolSize: 2 },
      close: vi.fn(),
    })
    const env = { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'preview.example.invalid', VERCEL_REGION: 'iad1' }
    configureMongoPool(client as unknown as Parameters<typeof configureMongoPool>[0], env)
    configureMongoPool(client as unknown as Parameters<typeof configureMongoPool>[0], env)
    expect(client.listenerCount('connectionCheckedOut')).toBe(1)
    client.emit('connectionCheckedOut')
    expect(waitUntil).toHaveBeenCalledOnce()
    let released = false
    void waitUntil.mock.calls[0][0].then(() => { released = true })
    await vi.advanceTimersByTimeAsync(349)
    expect(released).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(released).toBe(true)
    expect(client.close).not.toHaveBeenCalled()
  } finally {
    if (previous) Object.defineProperty(globalThis, key, previous)
    else Reflect.deleteProperty(globalThis, key)
    vi.useRealTimers()
    vi.unstubAllEnvs()
  }
})
