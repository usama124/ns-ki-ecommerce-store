// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
vi.mock('payload', () => ({
  createLocalReq: async ({ user }: { user?: unknown }, payload: unknown) => ({
    user,
    payload,
    context: {},
  }),
}))
import {
  commerceSession,
  commerceTransaction,
  requireCommerceReady,
} from '@/utilities/commerceDatabase'
import { checkoutKey } from '@/utilities/checkoutCommand'
import { enforceRequestLimit, trustedClientIP } from '@/utilities/requestLimits'
import { RequestError, requestError } from '@/utilities/apiSecurity'

let payload: Payload
let adapter: Record<string, any>
let sessions: Array<Record<string, any>>
let collection: Record<string, any>
beforeEach(() => {
  sessions = []
  collection = {
    findOne: vi.fn().mockResolvedValue({ ready: true }),
    findOneAndUpdate: vi.fn().mockResolvedValue({ count: 1 }),
  }
  adapter = {
    name: 'mongoose',
    transactionOptions: {},
    sessions: {},
    connection: {
      db: { collection: () => collection },
      getClient: () => ({
        startSession: () => {
          let running = false
          const session = {
            startTransaction: vi.fn(() => {
              running = true
            }),
            inTransaction: () => running,
            commitTransaction: vi.fn(async () => {
              running = false
            }),
            abortTransaction: vi.fn(async () => {
              running = false
            }),
            endSession: vi.fn(),
          }
          sessions.push(session)
          return session
        },
      }),
    },
  }
  payload = { db: adapter, config: { secret: 'unit-only-commerce-secret' } } as unknown as Payload
})
afterEach(() => vi.unstubAllEnvs())

describe('commerce transaction safety', () => {
  it('requires a ready transaction-enabled MongoDB adapter', async () => {
    adapter.name = 'postgres'
    await expect(requireCommerceReady(payload)).rejects.toMatchObject({ status: 503 })
    adapter.name = 'mongoose'
    adapter.transactionOptions = false
    await expect(requireCommerceReady(payload)).rejects.toMatchObject({ status: 503 })
    adapter.transactionOptions = undefined
    await expect(requireCommerceReady(payload)).rejects.toMatchObject({ status: 503 })
    adapter.transactionOptions = {}
    collection.findOne.mockResolvedValue(null)
    await expect(requireCommerceReady(payload)).rejects.toThrow('initialization')
  })
  it('threads one live session through work and commits before returning', async () => {
    const work = vi.fn(async (req) => {
      expect(await commerceSession(req)).toBe(sessions[0])
      return 'done'
    })
    expect(await commerceTransaction(payload, null, work)).toBe('done')
    expect(sessions[0].commitTransaction).toHaveBeenCalledTimes(1)
    expect(sessions[0].endSession).toHaveBeenCalledTimes(1)
    expect(adapter.sessions).toEqual({})
  })
  it('rejects missing or inactive sessions rather than silently running stock operations', async () => {
    await expect(commerceSession({ payload } as PayloadRequest)).rejects.toThrow(
      'verified inventory transaction',
    )
    adapter.sessions.test = { inTransaction: () => false }
    await expect(
      commerceSession({ payload, transactionID: 'test' } as PayloadRequest),
    ).rejects.toThrow('verified inventory transaction')
  })
  it('rolls back ordinary failures without retrying the purchase', async () => {
    const work = vi.fn().mockRejectedValue(new Error('invalid operation'))
    await expect(commerceTransaction(payload, null, work)).rejects.toThrow('invalid operation')
    expect(work).toHaveBeenCalledTimes(1)
    expect(sessions[0].abortTransaction).toHaveBeenCalledTimes(1)
    expect(adapter.sessions).toEqual({})
  })
  it('retries a write-conflict body with a fresh session, within a fixed bound', async () => {
    const work = vi.fn().mockRejectedValueOnce({ code: 112 }).mockResolvedValue('recovered')
    expect(await commerceTransaction(payload, null, work)).toBe('recovered')
    expect(work).toHaveBeenCalledTimes(2)
    expect(sessions).toHaveLength(2)
    const fail = vi.fn().mockRejectedValue({ code: 112 })
    await expect(commerceTransaction(payload, null, fail)).rejects.toMatchObject({ code: 112 })
    expect(fail).toHaveBeenCalledTimes(4)
  })
  it('retries order-number uniqueness collisions as well as native duplicate claims', async () => {
    for (const error of [{ code: 11000 }, { data: { errors: [{ path: 'orderNumber' }] } }]) {
      const work = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok')
      expect(await commerceTransaction(payload, null, work, true)).toBe('ok')
      expect(work).toHaveBeenCalledTimes(2)
    }
  })
  it('retries an ambiguous commit on the SAME session, never a fresh order body', async () => {
    const work = vi.fn(async () => {
      sessions[0].commitTransaction.mockRejectedValueOnce({
        hasErrorLabel: (label: string) => label === 'UnknownTransactionCommitResult',
      })
      return 'saved'
    })
    expect(await commerceTransaction(payload, null, work)).toBe('saved')
    expect(work).toHaveBeenCalledTimes(1)
    expect(sessions[0].commitTransaction).toHaveBeenCalledTimes(2)
    expect(sessions).toHaveLength(1)
  })
  it('does not execute another body after unresolved commit ambiguity', async () => {
    const work = vi.fn(async () => {
      sessions[0].commitTransaction.mockRejectedValue({
        hasErrorLabel: (label: string) => label === 'UnknownTransactionCommitResult',
      })
      return 'unknown'
    })
    await expect(commerceTransaction(payload, null, work)).rejects.toBeDefined()
    expect(work).toHaveBeenCalledTimes(1)
    expect(sessions[0].commitTransaction).toHaveBeenCalledTimes(3)
  })
})

describe('abuse controls and retry capabilities', () => {
  it('requires an unguessable UUID-v4 checkout key', () => {
    for (const value of [
      null,
      '',
      'order-123',
      'not-a-key',
      '00000000-0000-0000-0000-000000000000',
    ])
      expect(() => checkoutKey(value)).toThrow()
    expect(checkoutKey('d380dd57-0d67-47ad-8273-e89de578ad59')).toMatch(/^[a-f0-9]{64}$/)
  })
  it('does not trust spoofed proxy headers outside Vercel', () => {
    vi.stubEnv('VERCEL', '')
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8' })
    expect(trustedClientIP(headers)).toBe('shared-unverified-client')
    vi.stubEnv('VERCEL', '1')
    expect(trustedClientIP(headers)).toBe('1.2.3.4')
    headers.set('x-forwarded-for', '1.2.3.4, 5.6.7.8')
    expect(trustedClientIP(headers)).toBe('shared-unverified-client')
  })
  it('uses private hashed shared counters with a TTL and rejects excess attempts', async () => {
    await enforceRequestLimit(payload, new Headers(), 'checkout', '03001112222')
    expect(collection.findOneAndUpdate).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(collection.findOneAndUpdate.mock.calls)).not.toContain('03001112222')
    expect(collection.findOneAndUpdate.mock.calls[0][1].$setOnInsert.expiresAt).toBeInstanceOf(Date)
    collection.findOneAndUpdate.mockResolvedValue({ count: 10000 })
    await expect(
      enforceRequestLimit(payload, new Headers(), 'checkout', '03001112222'),
    ).rejects.toMatchObject({ status: 429 })
    expect(requestError(new RequestError('Limited', 429)).headers.get('Retry-After')).toBe('900')
  })
})
