import catalog from '@/data/pakistan-cities.json'

export const pakistanRegions = Object.keys(catalog) as (keyof typeof catalog)[]
export type PakistanRegion = keyof typeof catalog
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
export function citiesForRegion(region: string): string[] {
  return Object.hasOwn(catalog, region) ? catalog[region as PakistanRegion] : []
}
export function searchCities(region: string, query: string): string[] {
  return citiesForRegion(region).filter(city => normalize(city).includes(normalize(query)))
}

// This is address validation, not a courier serviceability guarantee. Unlisted towns
// remain valid via manual entry; known cities must match their selected region.
export function validatePakistanLocation(province: unknown, city: unknown): string | null {
  if (typeof province !== 'string' || !pakistanRegions.includes(province as PakistanRegion)) {
    return 'Please select a valid province / region.'
  }
  if (typeof city !== 'string' || city.trim().length < 2 || city.length > 120 || /[\p{Cc}\p{Cf}<>]/u.test(city) || normalize(city) === 'other') {
    return 'Please enter or select your actual city / town (2–120 characters).'
  }
  const key = normalize(city)
  if (citiesForRegion(province).some(name => normalize(name) === key)) return null
  if (pakistanRegions.some(region => citiesForRegion(region).some(name => normalize(name) === key))) {
    return 'This city does not belong to the selected province / region. Please check your location.'
  }
  return null
}
