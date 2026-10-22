import type { ProductsSelect } from '@/payload-types'

// Listing cards do not need rich text, videos, stock arrays, or payment data.
export const productCardSelect = {
  title: true,
  slug: true,
  basePricePKR: true,
  primaryCategory: true,
  categories: true,
  images: true,
} as const satisfies ProductsSelect
