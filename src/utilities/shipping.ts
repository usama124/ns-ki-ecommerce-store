/**
 * Pakistani city-based shipping calculator
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

type ShippingSettings = {
  freeShippingThreshold?: number | null
  majorCityFee?: number | null
  secondaryCityFee?: number | null
  majorCities?: Array<{ city: string }> | null
}

export function calculateShipping(city: string, subtotal: number, settings?: ShippingSettings | null): number {
  if (subtotal >= (settings?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD)) return 0

  const cities = settings?.majorCities?.length ? settings.majorCities.map(item => item.city) : MAJOR_CITIES
  const isMajorCity = cities.some(
    (c) => c.toLowerCase() === city.trim().toLowerCase()
  )

  return isMajorCity ? (settings?.majorCityFee ?? MAJOR_CITY_FEE) : (settings?.secondaryCityFee ?? SECONDARY_CITY_FEE)
}

export function getShippingLabel(fee: number): string {
  if (fee === 0) return 'FREE'
  return `Rs. ${fee.toLocaleString()}`
}
