// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ ready: vi.fn(), request: vi.fn(), read: vi.fn(), claim: vi.fn(), update: vi.fn() }))
vi.mock('@/utilities/commerceDatabase', () => ({ COMMERCE: { config: 'test-config' }, requireCommerceReady: mock.ready }))
vi.mock('@/utilities/instaworldClient', () => ({ instaRequest: mock.request }))
import { getCodCoverage, mapInstaCities } from '@/utilities/instaworldCities'
import { citiesForRegion, pakistanRegions } from '@/utilities/pakistanLocations'
let row: Record<string, any> | null
beforeEach(() => {
  vi.resetAllMocks(); row = null
  vi.stubEnv('INSTAWORLD_API_KEY', 'test-city-key')
  mock.ready.mockResolvedValue({ db: { collection: () => ({ findOne: mock.read, findOneAndUpdate: mock.claim, updateOne: mock.update }) } })
  mock.read.mockImplementation(async () => row ? structuredClone(row) : null)
  mock.update.mockImplementation(async (filter, op) => {
    if (filter.expiresAt && !(row?.expiresAt > filter.expiresAt.$gt)) return { modifiedCount: 0 }
    if (!row && op.$setOnInsert) row = { _id: filter._id, ...op.$setOnInsert }
    if (row) Object.assign(row, op.$set)
    return { modifiedCount: 1 }
  })
  mock.claim.mockImplementation(async (_filter, op) => {
    if (row?.lockUntil > new Date()) return null
    if (row) Object.assign(row, op.$set)
    return row ? structuredClone(row) : null
  })
  mock.request.mockResolvedValue([{ name: 'LAHORE' }, { name: 'KARACHI' }, { name: 'FAKE UNMAPPED DESTINATION' }])
})
afterEach(() => vi.unstubAllEnvs())
describe('supported COD destinations and shared cache', () => {
  it('keeps exact provider names and maps provinces only from unique catalog matches', () => {
    expect(mapInstaCities(['LAHORE', 'KARACHI', 'FAKE UNMAPPED DESTINATION'])).toEqual([
      { name: 'KARACHI', label: 'Karachi', province: 'Sindh' },
      { name: 'LAHORE', label: 'Lahore', province: 'Punjab' },
    ])
    expect(mapInstaCities(['LAHORE', 'Lahore'])).toHaveLength(1)
  })
  it('does not guess provinces for ambiguous names', () => {
    const counts = new Map<string, number>()
    for (const region of pakistanRegions) for (const city of citiesForRegion(region)) counts.set(city.toLowerCase(), (counts.get(city.toLowerCase()) || 0) + 1)
    const ambiguous = [...counts].filter(([, count]) => count > 1).map(([city]) => city.toUpperCase())
    expect(mapInstaCities(ambiguous)).toEqual([])
  })
  it('fetches cities once and reuses the same fresh cache across calls', async () => {
    const first = await getCodCoverage({} as never)
    expect(first.cities).toHaveLength(2)
    expect(await getCodCoverage({} as never)).toEqual(first)
    expect(mock.request).toHaveBeenCalledExactlyOnceWith('/cities')
    expect(row!.expiresAt.getTime() - row!.checkedAt.getTime()).toBe(3600000)
    expect(JSON.stringify(first)).not.toContain('test-city-key')
  })
  it('fails closed without credentials and never requests pickup locations for checkout', async () => {
    vi.stubEnv('INSTAWORLD_API_KEY', '')
    await expect(getCodCoverage({} as never)).rejects.toMatchObject({ status: 503 })
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('refreshes expired coverage and removes destinations no longer in the provider list', async () => {
    await getCodCoverage({} as never)
    row!.expiresAt = new Date(0)
    mock.request.mockResolvedValue([{ name: 'LAHORE' }])
    expect((await getCodCoverage({} as never)).cities.map(c => c.name)).toEqual(['LAHORE'])
    expect(mock.request).toHaveBeenCalledTimes(2)
  })
  it('preserves the previous snapshot but refuses stale coverage during an outage', async () => {
    await getCodCoverage({} as never)
    row!.expiresAt = new Date(0)
    mock.request.mockRejectedValue(new Error('provider unavailable'))
    await expect(getCodCoverage({} as never)).rejects.toMatchObject({ status: 503 })
    expect(row!.cities).toContain('LAHORE')
    expect(row!.lockUntil > new Date()).toBe(true)
    mock.request.mockClear()
    await expect(getCodCoverage({} as never)).rejects.toMatchObject({ status: 503 })
    expect(mock.request).not.toHaveBeenCalled()
  })
  it.each([[], {}, [{ name: '<invalid>' }], [{ name: '' }]])('does not cache invalid or empty upstream data %j', async data => {
    mock.request.mockResolvedValue(data)
    await expect(getCodCoverage({} as never)).rejects.toMatchObject({ status: 503 })
    expect(row).not.toHaveProperty('cities')
  })
})
