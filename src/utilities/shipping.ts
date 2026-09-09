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

export function calculateShipping(city: string, subtotal: number): number {
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0

  const isMajorCity = MAJOR_CITIES.some(
    (c) => c.toLowerCase() === city.trim().toLowerCase()
  )

  return isMajorCity ? MAJOR_CITY_FEE : SECONDARY_CITY_FEE
}

export function getShippingLabel(fee: number): string {
  if (fee === 0) return 'FREE'
  return `Rs. ${fee.toLocaleString()}`
}
