import { createHmac, timingSafeEqual } from 'node:crypto'

const LIFETIME = 7 * 24 * 60 * 60
const signature = (id: string, expiry: number, secret: string) =>
  createHmac('sha256', secret).update(`nski:order-view:v1:${id}:${expiry}`).digest('hex')

/** Scoped guest capability; knowing an order ID/email alone never grants access. */
export function signOrderAccess(id: string | number, secret: string, now = Date.now()) {
  if (!secret) throw new Error('Order access signing is unavailable')
  const expiry = Math.floor(now / 1000) + LIFETIME
  return `${expiry}.${signature(String(id), expiry, secret)}`
}

export function verifyOrderAccess(
  id: string | number,
  token: unknown,
  secret: string,
  now = Date.now(),
) {
  if (!secret || typeof token !== 'string' || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false
  const [rawExpiry, mac] = token.split('.')
  const expiry = Number(rawExpiry)
  const seconds = Math.floor(now / 1000)
  if (expiry <= seconds || expiry > seconds + LIFETIME) return false
  return timingSafeEqual(
    Buffer.from(mac, 'hex'),
    Buffer.from(signature(String(id), expiry, secret), 'hex'),
  )
}
