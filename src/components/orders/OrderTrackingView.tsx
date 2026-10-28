'use client'

import { CheckCircle2, Clock, ExternalLink, Package, Search, Truck, XCircle } from 'lucide-react'
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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-[0.3em] font-semibold text-[#648698] block mb-2">
            N's KI Customer Care
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold uppercase tracking-[0.15em] text-[#03171E] dark:text-[#CBCCC7]">
            Track Your Order
          </h1>
          <p className="mt-3 text-xs uppercase tracking-widest text-gray-600 dark:text-[#648698] max-w-md mx-auto leading-relaxed">
            Enter your order number and registered phone number or email address to view live status
            and dispatch updates.
          </p>
        </div>

        {/* Search Card */}
        <div className="glass-card p-6 sm:p-8 rounded-2xl mb-10 border border-[#648698]/30">
          <form onSubmit={handleTrack} className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label className="block text-[11px] uppercase tracking-widest font-semibold text-[#03171E] dark:text-[#CBCCC7] mb-1">
                Order Number *
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. #NKI-920182 or 920182"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg border border-[#648698]/30 focus:border-[#648698] focus:outline-hidden bg-white/80 dark:bg-[#07242e]"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] uppercase tracking-widest font-semibold text-[#03171E] dark:text-[#CBCCC7] mb-1">
                Phone Number or Email *
              </label>
              <input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="03001234567 or email@domain.com"
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-[#648698]/30 focus:border-[#648698] focus:outline-hidden bg-white/80 dark:bg-[#07242e]"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 glass-button-primary text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 text-xs font-medium uppercase tracking-wider rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Order Details Result */}
        {order && (
          <div className="space-y-8">
            {/* Status Header */}
            <div className="bg-[#03171E] text-[#CBCCC7] p-6 rounded-2xl border border-[#648698]/40 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#648698] block">
                  Order Reference
                </span>
                <span className="font-mono text-lg font-bold text-[#CBCCC7]">
                  {order.orderNumber}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#648698] block">
                  Date Placed
                </span>
                <span className="text-xs font-medium text-white">
                  {new Date(order.createdAt).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#648698] block">
                  Status
                </span>
                <span className="inline-block bg-[#648698] text-white px-3 py-1 text-xs uppercase tracking-wider font-bold rounded-md shadow-xs">
                  {order.status?.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Cancelled Banner */}
            {order.status === 'cancelled' && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-800 dark:text-red-200">
                <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">Order Cancelled</h4>
                  <p className="text-[11px] text-red-700 dark:text-red-300">
                    This order was cancelled. Reserved items have been returned to stock. For
                    assistance, contact customercare@nski.pk.
                  </p>
                </div>
              </div>
            )}

            {/* Visual Timeline (for non-cancelled orders) */}
            {order.status !== 'cancelled' && (
              <div className="glass-card border border-[#648698]/30 p-6 sm:p-8 rounded-2xl">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#03171E] dark:text-[#CBCCC7] mb-6 flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#648698]" /> Order Status Timeline
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
                          className={`w-9 h-9 rounded-full flex items-center justify-center z-10 transition-all ${
                            isCompleted
                              ? 'bg-[#03171E] dark:bg-[#648698] text-[#CBCCC7]'
                              : isCurrent
                                ? 'bg-[#648698] text-white ring-4 ring-[#648698]/20'
                                : 'bg-gray-200 dark:bg-[#07242e] text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          ) : isCurrent ? (
                            <Clock className="h-5 w-5 text-white animate-pulse" />
                          ) : (
                            <span className="text-xs font-bold">{idx + 1}</span>
                          )}
                        </div>

                        {/* Label */}
                        <div>
                          <p
                            className={`text-xs uppercase tracking-wider font-bold ${isCurrent || isCompleted ? 'text-[#03171E] dark:text-[#CBCCC7]' : 'text-gray-400'}`}
                          >
                            {step.label}
                          </p>
                          <p className="text-[10px] text-[#648698]">{step.desc}</p>
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
                <div className="bg-[#648698]/15 border border-[#648698]/30 p-6 rounded-2xl backdrop-blur-md">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#03171E] dark:text-[#CBCCC7] mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#648698]" /> Courier Dispatch Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-[#648698] uppercase tracking-widest text-[10px] block">
                        Courier Partner
                      </span>
                      <span className="font-semibold text-[#03171E] dark:text-[#f0f3f4] uppercase">
                        {order.fulfillment.courierName || 'Standard Express'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#648698] uppercase tracking-widest text-[10px] block">
                        Tracking Number
                      </span>
                      <span className="font-mono font-bold text-[#03171E] dark:text-[#CBCCC7]">
                        {order.fulfillment.trackingNumber || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#648698] uppercase tracking-widest text-[10px] block">
                        Track Online
                      </span>
                      {order.fulfillment.trackingUrl ? (
                        <a
                          href={order.fulfillment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#648698] font-bold uppercase underline hover:text-[#03171E]"
                        >
                          Open Carrier Site <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-gray-500">Dispatched via Courier</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

            <p className="text-sm text-muted-foreground">For your privacy, this lookup shows status and courier updates only. Use your secure order link or sign in to view delivery and billing details.</p>
          </div>
        )}
      </div>
    </div>
  )
}
