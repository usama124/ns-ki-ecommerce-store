import type { Payload } from 'payload'
import { createHash, randomUUID } from 'node:crypto'
import { RequestError } from './apiSecurity'
import { COMMERCE, requireCommerceReady, type InternalRecord } from './commerceDatabase'
import { instaRequest } from './instaworldClient'
import { citiesForRegion, pakistanRegions } from './pakistanLocations'
import type { CodCoverage, CodCity } from './codCoverage'
import { cityKey } from './codCoverage'

/** Names alone do not prove a province: only unique exact catalog matches. */
export function mapInstaCities(names: string[]): CodCity[] {
  const matches = new Map<string, { province: string; label: string }[]>()
  for (const province of pakistanRegions) for (const label of citiesForRegion(province)) {
    const key = cityKey(label)
    matches.set(key, [...(matches.get(key) || []), { province, label }])
  }
  const included = new Set<string>()
  return names.flatMap(name => {
    const key = cityKey(name), candidates = matches.get(key)
    if (included.has(key) || candidates?.length !== 1) return []
    included.add(key)
    return [{ name, ...candidates[0] }]
  }).sort((a, b) => a.label.localeCompare(b.label))
}

/** Shared Mongo cache/lease across Vercel instances; no schema/index creation. */
export async function getCodCoverage(payload: Payload): Promise<CodCoverage> {
  const token = process.env.INSTAWORLD_API_KEY?.trim()
  if (!token) throw new RequestError('COD city coverage is unavailable. Please choose another payment method.', 503)
  const { db } = await requireCommerceReady(payload)
  const records = db.collection<InternalRecord>(COMMERCE.config)
  const id = `instaworld:cities:${createHash('sha256').update(token).digest('hex')}`
  const now = new Date()
  const cached = await records.findOne({ _id: id })
  const result = (record: InternalRecord): CodCoverage => ({ cities: mapInstaCities(record.cities), checkedAt: new Date(record.checkedAt).toISOString() })
  if (cached && cached.expiresAt > now && Array.isArray(cached.cities)) return result(cached)
  if (!cached) {
    try { await records.updateOne({ _id: id }, { $setOnInsert: { lockUntil: new Date(0) } }, { upsert: true }) }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error }
  }
  const lease = randomUUID()
  const claimed = await records.findOneAndUpdate({ _id: id, lockUntil: { $lte: now } }, { $set: { lease, lockUntil: new Date(now.getTime() + 30000) } }, { returnDocument: 'after' })
  if (!claimed) {
    const latest = await records.findOne({ _id: id })
    if (latest && latest.expiresAt > new Date() && Array.isArray(latest.cities)) return result(latest)
    throw new RequestError('COD city coverage is refreshing. Please retry shortly or choose another payment method.', 503)
  }
  try {
    const data = await instaRequest('/cities')
    if (!Array.isArray(data) || !data.length || data.length > 20000 || data.some(c => !c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 120 || /[\u0000-\u001f<>]/.test(c.name)))
      throw new RequestError('COD city coverage is unavailable. Please choose another payment method.', 503)
    const cities = [...new Set<string>(data.map(c => c.name))]
    const checkedAt = new Date()
    await records.updateOne({ _id: id, lease }, { $set: { cities, checkedAt, expiresAt: new Date(checkedAt.getTime() + 3600000) } })
    return { cities: mapInstaCities(cities), checkedAt: checkedAt.toISOString() }
  } catch {
    // Keep the last good snapshot, but do not use expired coverage to accept COD.
    await records.updateOne({ _id: id, lease }, { $set: { lockUntil: new Date(Date.now() + 60000) } })
    throw new RequestError('COD city coverage is unavailable. Please choose another payment method.', 503)
  } finally {
    // A successful cache fill releases immediately; failed fills retain backoff.
    await records.updateOne({ _id: id, lease, expiresAt: { $gt: new Date() } }, { $set: { lockUntil: new Date(0) } })
  }
}
