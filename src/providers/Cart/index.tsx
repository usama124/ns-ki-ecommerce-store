'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'

export type CartItem = {
  productId: string
  slug: string
  title: string
  imageUrl?: string
  variantSize: string
  variantColor?: string
  variantSku?: string
  price: number
  quantity: number
  stock?: number
  allowBackorder?: boolean
}

type CartContextType = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string, variantSize: string, variantColor?: string) => void
  updateQuantity: (
    productId: string,
    variantSize: string,
    variantColor: string | undefined,
    quantity: number,
  ) => void
  clearCart: () => void
  validateCartStock: () => Promise<{ valid: boolean; adjustments: any[] }>
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextType | null>(null)

const CART_STORAGE_KEY = 'nski_cart'
const LEGACY_CART_STORAGE_KEY = 'lujain_cart'

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored =
      localStorage.getItem(CART_STORAGE_KEY) || localStorage.getItem(LEGACY_CART_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/** Two cart items are the same variant if productId + size match */
function isSameVariant(
  a: CartItem,
  b: { productId: string; variantSize: string; variantColor?: string },
): boolean {
  return a.productId === b.productId && a.variantSize === b.variantSize
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setItems(loadCart())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) saveCart(items)
  }, [items, mounted])

  const addItem = useCallback((newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const qtyToAdd = newItem.quantity ?? 1
      const existingIndex = prev.findIndex((i) => isSameVariant(i, newItem))
      const existingQty = existingIndex >= 0 ? prev[existingIndex].quantity : 0
      const requestedTotal = existingQty + qtyToAdd

      const availableStock = newItem.stock
      const allowBackorder = Boolean(newItem.allowBackorder)

      if (availableStock !== undefined && availableStock !== null && !allowBackorder) {
        if (requestedTotal > availableStock) {
          toast.error(
            `Cannot add to cart. Only ${availableStock} items available in stock (you already have ${existingQty} in your cart).`,
          )
          return prev
        }
      }

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: requestedTotal,
          stock: newItem.stock ?? updated[existingIndex].stock,
          allowBackorder: newItem.allowBackorder ?? updated[existingIndex].allowBackorder,
        }
        return updated
      }

      return [...prev, { ...newItem, quantity: qtyToAdd }]
    })
  }, [])

  const removeItem = useCallback(
    (productId: string, variantSize: string, variantColor?: string) => {
      setItems((prev) =>
        prev.filter((i) => !isSameVariant(i, { productId, variantSize, variantColor })),
      )
    },
    [],
  )

  const updateQuantity = useCallback(
    (
      productId: string,
      variantSize: string,
      variantColor: string | undefined,
      newQuantity: number,
    ) => {
      if (newQuantity < 1) {
        setItems((prev) =>
          prev.filter((i) => !isSameVariant(i, { productId, variantSize, variantColor })),
        )
        return
      }
      setItems((prev) =>
        prev.map((item) => {
          if (isSameVariant(item, { productId, variantSize, variantColor })) {
            const availableStock = item.stock
            const allowBackorder = Boolean(item.allowBackorder)

            if (
              availableStock !== undefined &&
              availableStock !== null &&
              !allowBackorder &&
              newQuantity > availableStock
            ) {
              toast.error('Max available stock reached')
              return { ...item, quantity: availableStock }
            }
            return { ...item, quantity: newQuantity }
          }
          return item
        }),
      )
    },
    [],
  )

  const validateCartStock = useCallback(async (): Promise<{
    valid: boolean
    adjustments: any[]
  }> => {
    if (items.length === 0) return { valid: true, adjustments: [] }

    try {
      const res = await fetch('/api/inventory/validate-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()

      if (!data.valid && Array.isArray(data.adjustments) && data.adjustments.length > 0) {
        const adjustmentMap = new Map<string, number>()
        data.adjustments.forEach((adj: any) => {
          adjustmentMap.set(`${adj.productId}-${adj.variantSize}`, adj.availableStock)
          toast.error(
            `${adj.title} - ${adj.variantSize} stock changed. Only ${adj.availableStock} items available.`,
          )
        })

        setItems(
          (prev) =>
            prev
              .map((item) => {
                const key = `${item.productId}-${item.variantSize}`
                if (adjustmentMap.has(key)) {
                  const newStock = adjustmentMap.get(key)!
                  if (newStock <= 0) return null
                  return { ...item, quantity: Math.min(item.quantity, newStock), stock: newStock }
                }
                return item
              })
              .filter(Boolean) as CartItem[],
        )

        return { valid: false, adjustments: data.adjustments }
      }

      return { valid: true, adjustments: [] }
    } catch {
      return { valid: true, adjustments: [] }
    }
  }, [items])

  const clearCart = useCallback(() => {
    setItems([])
    if (typeof window !== 'undefined') localStorage.removeItem(CART_STORAGE_KEY)
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        validateCartStock,
        clearCart,
        itemCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
