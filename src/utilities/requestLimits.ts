import type { Payload } from 'payload'
import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { COMMERCE, requireCommerceReady, type InternalRecord } from './commerceDatabase'
import { RequestError } from './apiSecurity'

const policies = {
  checkout: { subject: 15, ip: 60 },
  tracking: { subject: 20, ip: 100 },
  receipt: { subject: 10, ip: 40 },
  recovery: { subject: 5, ip: 20 },
  registration: { subject: 5, ip: 20 },
  password: { subject: 5, ip: 20 },
} as const

export function trustedClientIP(headers: Headers) {
  // Never trust cf-connecting-ip/XFF from an unverified direct-origin request.
  const value = process.env.VERCEL === '1' ? headers.get('x-forwarded-for')?.trim() : undefined
  return value && isIP(value) ? value : 'shared-unverified-client'
}

/** Atomic Mongo fixed-window counters shared by every warm instance. */
export async function enforceRequestLimit(
  payload: Payload,
  headers: Headers,
  action: keyof typeof policies,
  subject: string,
) {
  const { db } = await requireCommerceReady(payload)
  const policy = policies[action]
  const window = 15 * 60_000
  const start = Math.floor(Date.now() / window) * window
  for (const [kind, identity, maximum] of [
    ['subject', subject.trim().toLowerCase(), policy.subject],
    ['ip', trustedClientIP(headers), policy.ip],
    // A fleet-wide ceiling bounds intentional identity rotation; tune after load tests.
    ['global', 'all', 3000],
  ] as const) {
    const hash = createHmac('sha256', payload.config.secret)
      .update(`${action}:${kind}:${identity}`)
      .digest('hex')
    const result = await db
      .collection<InternalRecord>(COMMERCE.limits)
      .findOneAndUpdate(
        { _id: `${action}:${hash}:${start}` },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(start + window * 2) } },
        { upsert: true, returnDocument: 'after' },
      )
    if ((result?.count || 0) > maximum)
      throw new RequestError('Too many attempts. Please try again in 15 minutes.', 429)
  }
}
