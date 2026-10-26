// Import only CC0 DATA, not the publisher's application code. See docs/checkout-locations-and-qr.md.
// Usage: node scripts/import-pakistan-locations.mjs /path/to/PK.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const source = readFileSync(process.argv[2])
const country = JSON.parse(source)
const regions = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Azad Kashmir', 'Gilgit-Baltistan']
if (country.code !== 'PK') throw new Error('Expected Pakistan dataset')
const cities = Object.fromEntries(regions.map(name => {
  const region = country.regions.find(region => region.name === name)
  if (!region || !Array.isArray(region.settlements) || !region.settlements.length) throw new Error(`Missing ${name}`)
  const names = region.settlements.map(city => {
    if (typeof city.name !== 'string' || !city.name.trim() || city.name.length > 120) throw new Error('Invalid city')
    return city.name.trim().normalize('NFC')
  })
  return [name, [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en'))]
}))
mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../src/data/pakistan-cities.json', import.meta.url), JSON.stringify(cities, null, 2) + '\n')
console.log(JSON.stringify({ sha256: createHash('sha256').update(source).digest('hex'), counts: Object.fromEntries(Object.entries(cities).map(([region, list]) => [region, list.length])) }, null, 2))
