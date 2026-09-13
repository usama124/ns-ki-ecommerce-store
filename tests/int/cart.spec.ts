import { describe, expect, it } from 'vitest'

type CartItem = {
  productId: string
  variantSize: string
  variantColor?: string
  price: number
  quantity: number
}

function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

function calculateItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

function isSameVariant(
  a: CartItem,
  b: { productId: string; variantSize: string; variantColor?: string },
): boolean {
  return a.productId === b.productId && a.variantSize === b.variantSize
}

describe('Cart Provider & Multi-Variant Calculations', () => {
  it('correctly calculates subtotal and total item count', () => {
    const items: CartItem[] = [
      { productId: '1', variantSize: 'M', price: 12000, quantity: 2 },
      {
        productId: '2',
        variantSize: 'Unstitched',
        price: 8500,
        quantity: 1,
      },
    ]

    expect(calculateSubtotal(items)).toBe(32500)
    expect(calculateItemCount(items)).toBe(3)
  })

  it('treats different sizes of the same product as distinct cart items', () => {
    const itemA: CartItem = {
      productId: '1',
      variantSize: 'M',
      price: 12000,
      quantity: 1,
    }
    const itemB: CartItem = {
      productId: '1',
      variantSize: 'L',
      price: 12000,
      quantity: 1,
    }

    expect(isSameVariant(itemA, itemB)).toBe(false)
    expect(isSameVariant(itemA, { productId: '1', variantSize: 'M' })).toBe(true)
  })
})
