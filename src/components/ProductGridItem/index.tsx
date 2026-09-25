import { ProductCard } from '@/components/products/ProductCard'
import type { Product } from '@/payload-types'
import React from 'react'

type Props = {
  product: Partial<Product> & {
    salePriceDetails?: {
      isOnSale: boolean
      discountPercentage: number
      compareAtPrice: number | null
      effectivePrice: number
    }
  }
}

export const ProductGridItem: React.FC<Props> = ({ product }) => {
  return <ProductCard product={product} />
}
