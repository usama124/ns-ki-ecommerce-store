'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { parseStoredCart } from '@/utilities/cartStorage'
import { trackCartChange } from '@/lib/analytics/client'

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
    return parseStoredCart(stored)
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
  const currentItems = useRef<CartItem[]>([])
  const replaceItems = useCallback((next: CartItem[], userAction = false) => {
    const previous = currentItems.current
    currentItems.current = next
    setItems(next)
    // Event-handler-owned side effects, never React state-updater side effects.
    if (userAction) trackCartChange(previous, next)
  }, [])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    replaceItems(loadCart())
    setMounted(true)
  }, [replaceItems])

  useEffect(() => {
    if (mounted) saveCart(items)
  }, [items, mounted])

  const addItem = useCallback(
    (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      const prev = currentItems.current
      const qtyToAdd = newItem.quantity ?? 1
      if (!Number.isSafeInteger(qtyToAdd) || qtyToAdd < 1 || qtyToAdd > 99) return
      const existingIndex = prev.findIndex((i) => isSameVariant(i, newItem))
      const existingQty = existingIndex >= 0 ? prev[existingIndex].quantity : 0
      const requestedTotal = existingQty + qtyToAdd
      if (requestedTotal > 99) return

      const availableStock = newItem.stock
      const allowBackorder = Boolean(newItem.allowBackorder)

      if (availableStock !== undefined && availableStock !== null && !allowBackorder) {
        if (requestedTotal > availableStock) {
          toast.error(
            `Cannot add to cart. Only ${availableStock} items available in stock (you already have ${existingQty} in your cart).`,
          )
          return
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
        replaceItems(updated, true)
        return
      }

      replaceItems([...prev, { ...newItem, quantity: qtyToAdd }], true)
    },
    [replaceItems],
  )

  const removeItem = useCallback(
    (productId: string, variantSize: string, variantColor?: string) => {
      replaceItems(
        currentItems.current.filter(
          (i) => !isSameVariant(i, { productId, variantSize, variantColor }),
        ),
        true,
      )
    },
    [replaceItems],
  )

  const updateQuantity = useCallback(
    (
      productId: string,
      variantSize: string,
      variantColor: string | undefined,
      newQuantity: number,
    ) => {
      if (!Number.isSafeInteger(newQuantity) || newQuantity > 99) return
      if (newQuantity < 1) {
        replaceItems(
          currentItems.current.filter(
            (i) => !isSameVariant(i, { productId, variantSize, variantColor }),
          ),
          true,
        )
        return
      }
      replaceItems(
        currentItems.current
          .map((item) => {
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
          })
          .filter((item) => item.quantity > 0),
        true,
      )
    },
    [replaceItems],
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
      if (!res.ok) throw new Error('Stock validation failed')

      if (!data.valid && Array.isArray(data.adjustments) && data.adjustments.length > 0) {
        const adjustmentMap = new Map<string, number>()
        data.adjustments.forEach((adj: any) => {
          adjustmentMap.set(`${adj.productId}-${adj.variantSize}`, adj.availableStock)
          toast.error(
            `${adj.title} - ${adj.variantSize} stock changed. Only ${adj.availableStock} items available.`,
          )
        })

        replaceItems(
          currentItems.current
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
      toast.error('Unable to check current stock. Please try again before checking out.')
      return { valid: false, adjustments: [] }
    }
  }, [items, replaceItems])

  const clearCart = useCallback(() => {
    replaceItems([])
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(CART_STORAGE_KEY)
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY)
      } catch {
        /* Storage restrictions must not break a completed checkout. */
      }
    }
  }, [replaceItems])

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
