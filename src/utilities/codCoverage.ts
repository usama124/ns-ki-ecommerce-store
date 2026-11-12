export type CodCity = { province: string; name: string; label: string }
export type CodCoverage = { cities: CodCity[]; checkedAt: string }
export const cityKey = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
export function codCity(coverage: CodCoverage | null | undefined, province: string, city: string) {
  return coverage?.cities.find(c => c.province === province && cityKey(c.name) === cityKey(city))
}
