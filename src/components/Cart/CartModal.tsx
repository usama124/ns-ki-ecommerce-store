'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Minus, Plus, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'
import { OpenCart } from './OpenCart'

export function Cart() {
  const [isOpen, setIsOpen] = useState(false)
  const { items, removeItem, updateQuantity, itemCount, subtotal } = useCart()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      <OpenCart onClick={() => setIsOpen(true)} />

      {/* Backdrop */}
      {isOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Shopping bag"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <h2 className="text-sm font-medium uppercase tracking-widest">
              Your Bag{itemCount > 0 && ` (${itemCount})`}
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:opacity-60 transition-opacity"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag className="h-12 w-12 text-gray-200" />
              <p className="text-sm text-gray-500 uppercase tracking-widest">Your bag is empty</p>
              <Link
                href="/shop"
                onClick={() => setIsOpen(false)}
                className="text-xs uppercase tracking-widest border-b border-black pb-px hover:opacity-60 transition-opacity"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {items.map((item, index) => (
                <div key={`${item.productId}-${item.variantSize}-${item.variantColor}-${index}`} className="flex gap-4">
                  {/* Image */}
                  <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden bg-gray-50">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-full w-full bg-gray-100" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="text-sm font-medium hover:underline leading-tight"
                      >
                        {item.title}
                      </Link>
                      <button
                        onClick={() => removeItem(item.productId, item.variantSize, item.variantColor)}
                        className="ml-2 p-0.5 text-gray-400 hover:text-black transition-colors flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Size: {item.variantSize}
                      {item.variantColor && (
                        <span className="ml-2 text-gray-400">· {item.variantColor}</span>
                      )}
                    </p>

                    {item.variantSku && (
                      <p className="text-xs text-gray-400">SKU: {item.variantSku}</p>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      {/* Qty Controls */}
                      <div className="flex items-center gap-2 border border-gray-200">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantSize, item.variantColor, item.quantity - 1)
                          }
                          className="p-1 hover:bg-gray-100 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs w-6 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantSize, item.variantColor, item.quantity + 1)
                          }
                          className="p-1 hover:bg-gray-100 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <p className="text-sm font-medium">{formatPKR(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-6 py-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase tracking-widest text-gray-600">Subtotal</span>
              <span className="text-base font-medium">{formatPKR(subtotal)}</span>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Shipping calculated at checkout
            </p>
            <Link
              href="/checkout"
              onClick={() => setIsOpen(false)}
              className="block w-full bg-black text-white text-center py-4 text-xs font-medium uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Proceed to Checkout
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-center text-gray-500 hover:text-black transition-colors uppercase tracking-widest"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}
