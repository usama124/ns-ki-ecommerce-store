'use client'

import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'
import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { OpenCart } from './OpenCart'

export function Cart() {
  const [isOpen, setIsOpen] = useState(false)
  const [validatingCheckout, setValidatingCheckout] = useState(false)
  const { items, removeItem, updateQuantity, validateCartStock, itemCount, subtotal } = useCart()
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

  const handleProceedToCheckout = async (e: React.MouseEvent) => {
    e.preventDefault()
    setValidatingCheckout(true)
    const result = await validateCartStock()
    setValidatingCheckout(false)
    if (result.valid) {
      setIsOpen(false)
      router.push('/checkout')
    }
  }

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
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-stone-900" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-900">
              Your Bag{itemCount > 0 && ` (${itemCount})`}
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag className="h-12 w-12 text-stone-300" />
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-widest">
                Your bag is empty
              </p>
              <Link
                href="/shop"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold uppercase tracking-widest border-b-2 border-stone-900 pb-0.5 text-stone-900 hover:text-amber-800 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {items.map((item, index) => (
                <div
                  key={`${item.productId}-${item.variantSize}-${index}`}
                  className="flex gap-4 pb-4 border-b border-stone-100 last:border-0"
                >
                  {/* Image */}
                  <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden bg-stone-100 rounded border border-stone-200/60">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-full w-full bg-stone-200" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-semibold text-stone-900 hover:text-amber-800 leading-snug line-clamp-2 uppercase tracking-wide"
                      >
                        {item.title}
                      </Link>
                      <button
                        onClick={() =>
                          removeItem(item.productId, item.variantSize, item.variantColor)
                        }
                        className="p-1 text-stone-400 hover:text-red-600 transition-colors flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                        Size: {item.variantSize}
                      </span>
                    </div>

                    {item.variantSku && (
                      <p className="text-[10px] font-mono text-stone-500">SKU: {item.variantSku}</p>
                    )}

                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center justify-between">
                        {/* Qty Controls */}
                        {(() => {
                          const isMaxStockReached =
                            item.stock !== undefined &&
                            item.stock !== null &&
                            !item.allowBackorder &&
                            item.quantity >= item.stock

                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 border border-stone-300 rounded bg-white">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.productId,
                                      item.variantSize,
                                      item.variantColor,
                                      item.quantity - 1,
                                    )
                                  }
                                  className="p-1 hover:bg-stone-100 text-stone-700 transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-xs w-6 text-center font-bold text-stone-900">
                                  {item.quantity}
                                </span>
                                <button
                                  disabled={isMaxStockReached}
                                  onClick={() =>
                                    updateQuantity(
                                      item.productId,
                                      item.variantSize,
                                      item.variantColor,
                                      item.quantity + 1,
                                    )
                                  }
                                  className={`p-1 text-stone-700 transition-colors ${
                                    isMaxStockReached
                                      ? 'opacity-30 cursor-not-allowed'
                                      : 'hover:bg-stone-100'
                                  }`}
                                  aria-label="Increase quantity"
                                  title={
                                    isMaxStockReached
                                      ? `Maximum available stock (${item.stock}) reached`
                                      : 'Increase quantity'
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              {isMaxStockReached && (
                                <span className="text-[10px] font-semibold text-amber-800">
                                  Max available stock reached
                                </span>
                              )}
                            </div>
                          )
                        })()}

                        <p className="text-sm font-serif font-bold text-stone-900">
                          {formatPKR(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-stone-200 px-6 py-5 flex flex-col gap-3.5 bg-stone-50/50">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase tracking-widest font-semibold text-stone-700">
                Subtotal
              </span>
              <span className="text-lg font-serif font-bold text-stone-900">
                {formatPKR(subtotal)}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 text-center font-medium">
              Shipping & taxes calculated at checkout
            </p>
            <button
              onClick={handleProceedToCheckout}
              disabled={validatingCheckout}
              className="block w-full bg-stone-900 text-white text-center py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-stone-800 transition-colors shadow-md rounded disabled:opacity-50"
            >
              {validatingCheckout ? 'Validating Stock...' : 'Proceed to Checkout'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-center font-semibold text-stone-600 hover:text-stone-900 transition-colors uppercase tracking-widest py-1"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}
