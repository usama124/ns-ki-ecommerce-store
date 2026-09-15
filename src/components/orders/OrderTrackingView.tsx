'use client'

import { formatPKR } from '@/utilities/formatPKR'
import { CheckCircle2, Clock, ExternalLink, Package, Search, Truck, XCircle } from 'lucide-react'
import Image from 'next/image'
import React, { useState } from 'react'

type OrderStatus =
  'pending_verification' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const TIMELINE_STEPS: Array<{ key: OrderStatus; label: string; desc: string }> = [
  {
    key: 'pending_verification',
    label: 'Order Placed',
    desc: 'Pending verification',
  },
  {
    key: 'confirmed',
    label: 'Payment Verified',
    desc: 'Confirmed by store admin',
  },
  {
    key: 'processing',
    label: 'Processing',
    desc: 'Packing apparel',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    desc: 'Handed to courier',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    desc: 'Fulfillment complete',
  },
]

export function OrderTrackingView() {
  const [orderNumber, setOrderNumber] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<any>(null)

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOrder(null)

    if (!orderNumber || !contact) {
      setError('Please enter both Order Number and Phone or Email.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `/api/orders/track?orderNumber=${encodeURIComponent(
          orderNumber,
        )}&contact=${encodeURIComponent(contact)}`,
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to locate order.')
      }

      setOrder(data.order)
    } catch (err: any) {
      setError(err.message || 'No matching order found. Please check your inputs.')
    } finally {
      setLoading(false)
    }
  }

  const getStepStatus = (stepKey: OrderStatus, currentStatus: OrderStatus) => {
    if (currentStatus === 'cancelled') return 'cancelled'

    const orderSequence: OrderStatus[] = [
      'pending_verification',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
    ]

    const currentIndex = orderSequence.indexOf(currentStatus)
    const stepIndex = orderSequence.indexOf(stepKey)

    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'upcoming'
  }

  return (
    <div className="bg-[#FAF8F5] min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-[0.3em] font-semibold text-amber-800 block mb-2">
            N's KI Customer Care
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal uppercase tracking-[0.15em] text-stone-900">
            Track Your Order
          </h1>
          <p className="mt-3 text-xs uppercase tracking-widest text-stone-500 max-w-md mx-auto leading-relaxed">
            Enter your order number and registered phone number or email address to view live status
            and dispatch updates.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white border border-stone-200/80 p-6 sm:p-8 rounded-xl shadow-sm mb-10">
          <form onSubmit={handleTrack} className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label className="block text-[11px] uppercase tracking-widest font-semibold text-gray-700 mb-1">
                Order Number *
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. #NKI-920182 or 920182"
                className="w-full px-3 py-2.5 text-xs font-mono border border-gray-300 focus:border-black focus:outline-hidden bg-white"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] uppercase tracking-widest font-semibold text-gray-700 mb-1">
                Phone Number or Email *
              </label>
              <input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="03001234567 or email@domain.com"
                className="w-full px-3 py-2.5 text-xs border border-gray-300 focus:border-black focus:outline-hidden bg-white"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
              >
                {loading ? (
                  'Finding...'
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" /> Track
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium uppercase tracking-wider rounded-xs">
              {error}
            </div>
          )}
        </div>

        {/* Order Details Result */}
        {order && (
          <div className="space-y-8">
            {/* Status Header */}
            <div className="bg-black text-white p-6 rounded-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                  Order Reference
                </span>
                <span className="font-mono text-lg font-bold">{order.orderNumber}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                  Date Placed
                </span>
                <span className="text-xs font-medium">
                  {new Date(order.createdAt).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                  Status
                </span>
                <span className="inline-block bg-white text-black px-3 py-1 text-xs uppercase tracking-wider font-bold rounded-xs">
                  {order.status?.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Cancelled Banner */}
            {order.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xs flex items-center gap-3 text-red-800">
                <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">Order Cancelled</h4>
                  <p className="text-[11px] text-red-700">
                    This order was cancelled. Reserved items have been returned to stock. For
                    assistance, contact customercare@nski.pk.
                  </p>
                </div>
              </div>
            )}

            {/* Visual Timeline (for non-cancelled orders) */}
            {order.status !== 'cancelled' && (
              <div className="bg-neutral-50 border border-gray-200 p-6 sm:p-8 rounded-xs">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-black mb-6 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Order Status Timeline
                </h3>

                <div className="relative flex flex-col md:flex-row justify-between gap-6 md:gap-2">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const statusState = getStepStatus(step.key, order.status)
                    const isCompleted = statusState === 'completed'
                    const isCurrent = statusState === 'current'

                    return (
                      <div
                        key={step.key}
                        className="flex md:flex-col items-center flex-1 gap-4 md:gap-2 text-left md:text-center relative"
                      >
                        {/* Step Circle */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center z-10 transition-colors ${
                            isCompleted
                              ? 'bg-black text-white'
                              : isCurrent
                                ? 'bg-black text-white ring-4 ring-gray-200'
                                : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          ) : isCurrent ? (
                            <Clock className="h-5 w-5 text-white animate-pulse" />
                          ) : (
                            <span className="text-xs font-bold">{idx + 1}</span>
                          )}
                        </div>

                        {/* Label */}
                        <div>
                          <p
                            className={`text-xs uppercase tracking-wider font-bold ${isCurrent || isCompleted ? 'text-black' : 'text-gray-400'}`}
                          >
                            {step.label}
                          </p>
                          <p className="text-[10px] text-gray-500">{step.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Courier Tracking Box (If shipped/delivered) */}
            {order.fulfillment &&
              (order.fulfillment.courierName || order.fulfillment.trackingNumber) && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-xs">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-900 mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Courier Dispatch Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 uppercase tracking-widest text-[10px] block">
                        Courier Partner
                      </span>
                      <span className="font-semibold text-black uppercase">
                        {order.fulfillment.courierName || 'Standard Express'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase tracking-widest text-[10px] block">
                        Tracking Number
                      </span>
                      <span className="font-mono font-bold text-black">
                        {order.fulfillment.trackingNumber || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase tracking-widest text-[10px] block">
                        Track Online
                      </span>
                      {order.fulfillment.trackingUrl ? (
                        <a
                          href={order.fulfillment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-black font-bold uppercase underline hover:text-gray-700"
                        >
                          Open Carrier Site <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-gray-600">Dispatched via Courier</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* Order Items & Customer Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Items List */}
              <div className="lg:col-span-7 bg-neutral-50 border border-gray-200 p-6 rounded-xs">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-black mb-4 border-b pb-3 border-gray-200">
                  Order Items
                </h3>
                <div className="space-y-4">
                  {order.items?.map((item: any, idx: number) => {
                    const productObj = typeof item.product === 'object' ? item.product : null
                    const imageObj = productObj?.images?.[0]?.image
                    const imageUrl = typeof imageObj === 'object' ? imageObj?.url : undefined

                    return (
                      <div
                        key={idx}
                        className="flex gap-4 items-center border-b border-gray-100 pb-3 last:border-0"
                      >
                        <div className="relative w-14 h-18 bg-gray-200 flex-shrink-0">
                          {imageUrl && (
                            <Image
                              src={imageUrl}
                              alt={productObj?.title || 'Product'}
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                            {productObj?.title || 'Luxury Outfit'}
                          </h4>
                          <p className="text-[11px] text-gray-500 uppercase tracking-widest">
                            Size: {item.variantSize} | SKU: {item.variantSku || 'N/A'}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Qty: {item.quantity} × {formatPKR(item.unitPrice)}
                          </p>
                        </div>
                        <div className="text-xs font-bold text-black">
                          {formatPKR(item.unitPrice * item.quantity)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Delivery Address & Payment Summary */}
              <div className="lg:col-span-5 bg-neutral-50 border border-gray-200 p-6 rounded-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-black mb-4 border-b pb-3 border-gray-200">
                    Delivery & Billing Details
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                        Recipient
                      </span>
                      <span className="font-bold text-black">{order.customer?.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                        Phone
                      </span>
                      <span className="font-mono text-gray-800">{order.customer?.phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                        Shipping Address
                      </span>
                      <p className="text-gray-700">
                        {order.customer?.address}, {order.customer?.city},{' '}
                        {order.customer?.province}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 block">
                        Payment Method
                      </span>
                      <span className="font-bold uppercase text-black">
                        {order.paymentMethod?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="mt-6 pt-4 border-t border-gray-200 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPKR(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping Fee</span>
                    <span>{formatPKR(order.shippingFee)}</span>
                  </div>
                  {Boolean(order.codFee && order.codFee > 0) && (
                    <div className="flex justify-between text-amber-800 font-medium">
                      <span>Cash on Delivery (COD) Fee</span>
                      <span>+{formatPKR(order.codFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-black border-t pt-2 border-gray-300">
                    <span>Total Amount</span>
                    <span>{formatPKR(order.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
