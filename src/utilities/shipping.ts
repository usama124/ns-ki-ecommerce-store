/**
 * Nationwide flat shipping. Legacy city fields are ignored.
 */

export const MAJOR_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
]

export const MAJOR_CITY_FEE = 250
export const SECONDARY_CITY_FEE = 350
export const FREE_SHIPPING_THRESHOLD = 15000
export const FLAT_SHIPPING_FEE = 250

type ShippingSettings = {
  flatShippingFee?: number | null
  freeShippingEnabled?: boolean | null
  freeShippingThreshold?: number | null
  majorCityFee?: number | null
  secondaryCityFee?: number | null
  majorCities?: Array<{ city: string }> | null
}

export function calculateShipping(_city: string, subtotal: number, settings?: ShippingSettings | null): number {
  if (settings?.freeShippingEnabled === true && subtotal >= (settings.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD)) return 0
  return settings?.flatShippingFee ?? FLAT_SHIPPING_FEE
}

export function getShippingLabel(fee: number): string {
  if (fee === 0) return 'FREE'
  return `Rs. ${fee.toLocaleString()}`
}
