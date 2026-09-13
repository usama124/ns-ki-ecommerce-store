'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type CartItem = {
  productId: string
  slug: string
  title: string
  imageUrl?: string
  variantSize: string
  variantColor?: string // new
  variantSku?: string
  price: number
  quantity: number
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
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextType | null>(null)

const CART_STORAGE_KEY = 'lujain_cart'

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
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
      const qty = newItem.quantity ?? 1
      const existingIndex = prev.findIndex((i) => isSameVariant(i, newItem))
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        }
        return updated
      }
      return [...prev, { ...newItem, quantity: qty }]
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
      quantity: number,
    ) => {
      if (quantity < 1) {
        setItems((prev) =>
          prev.filter((i) => !isSameVariant(i, { productId, variantSize, variantColor })),
        )
        return
      }
      setItems((prev) =>
        prev.map((i) =>
          isSameVariant(i, { productId, variantSize, variantColor }) ? { ...i, quantity } : i,
        ),
      )
    },
    [],
  )

  const clearCart = useCallback(() => {
    setItems([])
    if (typeof window !== 'undefined') localStorage.removeItem(CART_STORAGE_KEY)
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal }}
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
