import { RequestError } from './apiSecurity'

const BASE = 'https://one-be.instaworld.pk/merchant-api/v2'
export class InstaError extends RequestError {
  constructor(public code: string, public upstreamStatus: number, public retryAfterSeconds = 0) {
    super(`InstaWorld request failed (${code}). Check the booking panel before retrying.`, 502)
  }
}
export async function instaRequest(path: string, body?: unknown, key?: string): Promise<unknown> {
  const token = process.env.INSTAWORLD_API_KEY?.trim()
  if (!token) throw new RequestError('InstaWorld API key is not configured.', 503)
  const response = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const reader = response.body?.getReader()
  if (!reader) throw new InstaError('invalid_response', response.status)
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new InstaError('response_too_large', response.status) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let result
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new InstaError('invalid_response', response.status) }
  if (!response.ok) {
    const code = typeof result?.error?.code === 'string' && /^[a-z_]{1,60}$/.test(result.error.code) ? result.error.code : 'upstream_error'
    const retry = Number(response.headers.get('retry-after'))
    throw new InstaError(code, response.status, Number.isFinite(retry) && retry > 0 ? Math.min(3600, Math.ceil(retry)) : 0)
  }
  if (!result || !Object.hasOwn(result, 'data')) throw new InstaError('invalid_response', response.status)
  return result.data
}

type Reference = { id: number; name: string; city: string }
export type InstaReferences = { locations: Reference[]; cities: string[] }
export async function instaReferences(): Promise<InstaReferences> {
  const [locations, cities] = await Promise.all([instaRequest('/locations'), instaRequest('/cities')])
  if (!Array.isArray(locations) || !Array.isArray(cities)) throw new InstaError('invalid_reference_data', 200)
  return {
    locations: locations.filter(l => l && l.is_active === true && Number.isSafeInteger(l.id) && l.id > 0 && typeof l.name === 'string').map(l => ({ id: l.id, name: l.name.slice(0, 200), city: typeof l.city === 'string' ? l.city.slice(0, 120) : '' })),
    cities: [...new Set<string>(cities.flatMap(c => c && typeof c.name === 'string' && c.name.length <= 120 ? [c.name] : []))],
  }
}

export type InstaTracking = { trackingNumber: string; status: string; statusRecordedAt: string | null; checkedAt: string; events: { status: string; recordedAt: string | null }[] }
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null
export function safeShipment(value: unknown, expectedReference: string, expectedTracking?: string): InstaTracking {
  const v = value as { ref_no?: unknown; tracking_number?: unknown; status?: { code?: unknown }; status_recorded_at?: unknown } | null
  if (!v || v.ref_no !== expectedReference || typeof v.tracking_number !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(v.tracking_number) || (expectedTracking && v.tracking_number !== expectedTracking) || typeof v.status?.code !== 'string' || !/^[A-Z_]{1,80}$/.test(v.status.code))
    throw new InstaError('shipment_mismatch', 200)
  return { trackingNumber: v.tracking_number, status: v.status.code, statusRecordedAt: date(v.status_recorded_at), checkedAt: new Date().toISOString(), events: [] }
}
export function safeEvents(value: unknown): InstaTracking['events'] {
  if (!Array.isArray(value)) throw new InstaError('invalid_tracking_events', 200)
  return value.slice(-100).flatMap(e => e && typeof e.status === 'string' && /^[A-Z_]{1,80}$/.test(e.status) ? [{ status: e.status, recordedAt: date(e.recorded_at) }] : [])
}
