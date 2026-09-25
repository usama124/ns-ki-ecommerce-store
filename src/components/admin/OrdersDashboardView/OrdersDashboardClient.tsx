'use client'

import { toast } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'
import {
  C,
  glassCard,
  pageWrap,
  btnPrimary,
  btnSecondary,
  btnDanger,
  inputStyle,
  TH,
  TD,
} from '../adminTheme'

export type OrderItem = {
  id?: string
  product: any
  variantSize: string
  variantColor?: string
  variantSku?: string
  quantity: number
  unitPrice: number
}

export type PaymentProof = {
  transactionId?: string
  screenshot?: any
}

export type FulfillmentInfo = {
  courierName?: string
  trackingNumber?: string
  trackingUrl?: string
}

export type CustomerInfo = {
  name: string
  email?: string
  phone: string
  address: string
  city: string
  province: string
}

export type OrderDoc = {
  id: string
  orderNumber: string
  status:
    'pending_verification' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentMethod: 'cod' | 'bank_transfer' | 'jazzcash' | 'easypaisa'
  customer: CustomerInfo
  paymentProof?: PaymentProof
  fulfillment?: FulfillmentInfo
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  codFee?: number
  totalAmount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Stats = {
  totalOrders: number
  pendingVerification: number
  confirmed: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
  totalRevenue: number
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { bg: string; color: string; border: string; icon: string; label: string }
  > = {
    pending_verification: {
      bg: C.warningBg,
      color: C.warningText,
      border: C.warningBorder,
      icon: '⏳',
      label: 'Pending Verification',
    },
    confirmed: {
      bg: C.successBg,
      color: C.successText,
      border: C.successBorder,
      icon: '✓',
      label: 'Confirmed',
    },
    processing: {
      bg: C.infoBg,
      color: C.infoText,
      border: C.infoBorder,
      icon: '⚙',
      label: 'Processing',
    },
    shipped: {
      bg: C.purpleBg,
      color: C.purpleText,
      border: C.purpleBorder,
      icon: '🚚',
      label: 'Shipped',
    },
    delivered: {
      bg: C.successBg,
      color: C.successText,
      border: C.successBorder,
      icon: '🎉',
      label: 'Delivered',
    },
    cancelled: {
      bg: C.dangerBg,
      color: C.dangerText,
      border: C.dangerBorder,
      icon: '✕',
      label: 'Cancelled',
    },
  }
  const config = map[status] || {
    bg: C.goldDim,
    color: C.pearl,
    border: C.border,
    icon: '•',
    label: status,
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

function PaymentMethodBadge({ method }: { method: string }) {
  const map: Record<string, { bg: string; color: string; border: string; icon: string; label: string }> = {
    cod: { bg: 'rgba(100, 134, 152, 0.15)', color: C.pearl, border: 'rgba(100, 134, 152, 0.3)', icon: '💵', label: 'COD' },
    bank_transfer: { bg: C.infoBg, color: C.infoText, border: C.infoBorder, icon: '🏦', label: 'Bank / Raast' },
    jazzcash: { bg: C.warningBg, color: C.warningText, border: C.warningBorder, icon: '📱', label: 'JazzCash' },
    easypaisa: { bg: C.successBg, color: C.successText, border: C.successBorder, icon: '📲', label: 'EasyPaisa' },
  }
  const config = map[method] || { bg: C.goldDim, color: C.gold, border: C.border, icon: '💳', label: method }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

function StanBadge({ trxId }: { trxId?: string }) {
  if (!trxId) return null
  const clean = String(trxId).replace(/[^a-zA-Z0-9]/g, '')
  if (clean.length !== 6) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        backgroundColor: C.goldDim,
        color: C.gold,
        border: `1px solid ${C.border}`,
        marginLeft: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      6-Digit STAN
    </span>
  )
}

export function OrdersDashboardClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderDoc[]>([])
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingVerification: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0,
  })

  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [updating, setUpdating] = useState(false)

  // Modals state
  const [activeDetailOrder, setActiveDetailOrder] = useState<OrderDoc | null>(null)
  const [quickVerifyOrder, setQuickVerifyOrder] = useState<OrderDoc | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [zoomScale, setZoomScale] = useState(1)

  // Tracking form inside detail view
  const [courierName, setCourierName] = useState('TCS')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/orders?status=${activeTab}&q=${encodeURIComponent(searchQuery)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders')
      setOrders(data.orders || [])
      setStats(
        data.stats || {
          totalOrders: 0,
          pendingVerification: 0,
          confirmed: 0,
          processing: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
          totalRevenue: 0,
        },
      )
    } catch (err: any) {
      setError(err?.message || 'Error loading orders')
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Update status function (single or batch)
  const handleUpdateStatus = async (
    targetIds: string[],
    newStatus: string,
    extraData?: { courierName?: string; trackingNumber?: string; trackingUrl?: string },
  ) => {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: targetIds,
          status: newStatus,
          ...extraData,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update order status')

      toast.success(
        targetIds.length > 1
          ? `Updated ${data.updatedCount} orders to ${newStatus}`
          : `Order status updated to ${newStatus}`,
      )

      setSelectedIds([])
      if (quickVerifyOrder) setQuickVerifyOrder(null)
      if (activeDetailOrder) {
        const updatedDoc = data.orders?.[0] || { ...activeDetailOrder, status: newStatus }
        setActiveDetailOrder(updatedDoc)
      }
      fetchOrders()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  // Multi-select handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(orders.map((o) => o.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleCopy = (text: string, label: string = 'TRX ID') => {
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${label} to clipboard!`)
  }

  const getMediaUrl = (media: any): string | null => {
    if (!media) return null
    if (typeof media === 'string') return media
    if (typeof media === 'object' && media.url) {
      return media.url
    }
    return null
  }

  const tabs = [
    { id: 'all', label: 'All Orders', count: stats.totalOrders, color: C.gold },
    {
      id: 'pending_verification',
      label: '⏳ Pending',
      count: stats.pendingVerification,
      color: '#f59e0b',
    },
    { id: 'confirmed', label: '✓ Confirmed', count: stats.confirmed, color: '#10b981' },
    { id: 'processing', label: '⚙ Processing', count: stats.processing, color: '#3b82f6' },
    { id: 'shipped', label: '🚚 Shipped', count: stats.shipped, color: '#a855f7' },
    { id: 'delivered', label: '🎉 Delivered', count: stats.delivered, color: '#14b8a6' },
    { id: 'cancelled', label: '✕ Cancelled', count: stats.cancelled, color: '#ef4444' },
  ]

  return (
    <div style={pageWrap}>
      {/* HEADER HERO CARD */}
      <div
        style={{
          ...glassCard,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '22px 28px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🛒</span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: C.textPrimary, letterSpacing: '-0.02em' }}>
              Orders &amp; Fulfillment Control Hub
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 36px', fontSize: '13px', color: C.textSecondary }}>
            Real-time status tracking, payment proof verification, and automated stock restoration.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          style={btnSecondary}
        >
          <span>🔄</span> Refresh Data
        </button>
      </div>

      {/* STATS METRICS CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Total Orders */}
        <div
          style={{
            ...glassCard,
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '11px', color: C.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Lifetime Orders
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: C.textPrimary }}>
            {stats.totalOrders}
          </div>
        </div>

        {/* Pending Verification */}
        <div
          style={{
            background: stats.pendingVerification > 0 ? C.warningBg : C.cardBg,
            border: `1px solid ${stats.pendingVerification > 0 ? C.warningBorder : C.border}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: C.shadowCard,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: C.warningText, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pending Verification
            </span>
            {stats.pendingVerification > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  fontSize: '9px',
                  fontWeight: 900,
                }}
              >
                ACTION
              </span>
            )}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: C.warningText }}>
            {stats.pendingVerification}
          </div>
        </div>

        {/* Confirmed */}
        <div style={{ ...glassCard, padding: '16px' }}>
          <div style={{ fontSize: '11px', color: C.successText, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Confirmed
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: C.successText }}>
            {stats.confirmed}
          </div>
        </div>

        {/* Processing */}
        <div style={{ ...glassCard, padding: '16px' }}>
          <div style={{ fontSize: '11px', color: C.infoText, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Processing
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: C.infoText }}>
            {stats.processing}
          </div>
        </div>

        {/* Shipped */}
        <div style={{ ...glassCard, padding: '16px' }}>
          <div style={{ fontSize: '11px', color: C.purpleText, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Shipped
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: C.purpleText }}>
            {stats.shipped}
          </div>
        </div>

        {/* Delivered */}
        <div style={{ ...glassCard, padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#14b8a6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Delivered
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: '#14b8a6' }}>
            {stats.delivered}
          </div>
        </div>

        {/* Cancelled */}
        <div style={{ ...glassCard, padding: '16px' }}>
          <div style={{ fontSize: '11px', color: C.dangerText, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Cancelled
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px', color: C.dangerText }}>
            {stats.cancelled}
          </div>
        </div>

        {/* Total Revenue */}
        <div
          style={{
            ...glassCard,
            padding: '16px',
            border: `1px solid ${C.borderHover}`,
            background: 'linear-gradient(135deg, rgba(20, 31, 28, 0.95) 0%, rgba(30, 48, 42, 0.95) 100%)',
          }}
        >
          <div style={{ fontSize: '11px', color: C.gold, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Total Revenue
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '6px', color: C.textGoldBright }}>
            Rs. {stats.totalRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div
        style={{
          ...glassCard,
          borderRadius: '12px 12px 0 0',
          borderBottom: 'none',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: isActive ? `1px solid ${tab.color}` : `1px solid ${C.borderInput}`,
                  background: isActive ? C.goldDim : 'transparent',
                  color: isActive ? C.textGoldBright : C.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? tab.color : 'rgba(255,255,255,0.08)',
                    color: isActive ? '#0a1210' : C.pearl,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={{ minWidth: '260px' }}>
          <input
            type="text"
            placeholder="🔍 Search Order #, Name, Phone, TRX…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...inputStyle,
              padding: '8px 12px',
            }}
          />
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div
          style={{
            background: 'rgba(212, 175, 55, 0.12)',
            borderLeft: `1px solid ${C.border}`,
            borderRight: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 800, color: C.textGoldBright }}>
            ✓ {selectedIds.length} orders selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={updating}
              onClick={() => handleUpdateStatus(selectedIds, 'confirmed')}
              style={{
                ...btnPrimary,
                padding: '6px 14px',
                fontSize: '11px',
              }}
            >
              ✓ Bulk Confirm
            </button>
            <button
              disabled={updating}
              onClick={() => handleUpdateStatus(selectedIds, 'cancelled')}
              style={{
                ...btnDanger,
                padding: '6px 14px',
                fontSize: '11px',
              }}
            >
              ✕ Bulk Cancel (Restores Stock)
            </button>
          </div>
        </div>
      )}

      {/* ORDERS DATA TABLE */}
      <div
        style={{
          ...glassCard,
          borderRadius: '0 0 12px 12px',
          overflowX: 'auto',
        }}
      >
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, fontSize: '14px', fontWeight: 600 }}>
            ⏳ Loading orders data...
          </div>
        ) : error ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.dangerText, fontSize: '14px', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted, fontSize: '14px', fontWeight: 600 }}>
            No orders found for the selected filter.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr>
                <th style={{ ...TH, width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === orders.length && orders.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{ accentColor: C.gold }}
                  />
                </th>
                <th style={TH}>Order #</th>
                <th style={TH}>Customer &amp; City</th>
                <th style={TH}>Payment Method</th>
                <th style={TH}>Status</th>
                <th style={TH}>Total Amount</th>
                <th style={TH}>Date Placed</th>
                <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isPending = order.status === 'pending_verification'
                return (
                  <tr
                    key={order.id}
                    style={{
                      background: isPending ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isPending ? 'rgba(245, 158, 11, 0.08)' : C.rowHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isPending ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
                    }}
                  >
                    <td style={TD}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => handleToggleSelect(order.id)}
                        style={{ accentColor: C.gold }}
                      />
                    </td>
                    <td style={{ ...TD, fontWeight: 800, fontFamily: 'monospace', color: C.textGoldBright }}>
                      {order.orderNumber}
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 700, color: C.textPrimary }}>
                        {order.customer?.name}
                      </div>
                      <div style={{ fontSize: '11px', color: C.textMuted }}>
                        {order.customer?.city}, {order.customer?.province}
                      </div>
                    </td>
                    <td style={TD}>
                      <PaymentMethodBadge method={order.paymentMethod} />
                      {order.paymentProof?.transactionId && (
                        <div
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: C.infoText,
                            marginTop: '3px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>TRX: {order.paymentProof.transactionId}</span>
                          <StanBadge trxId={order.paymentProof.transactionId} />
                        </div>
                      )}
                    </td>
                    <td style={TD}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td style={{ ...TD, fontWeight: 800, color: C.textPrimary }}>
                      Rs. {(order.totalAmount || 0).toLocaleString()}
                    </td>
                    <td style={{ ...TD, color: C.textMuted, fontSize: '12px' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {order.paymentMethod !== 'cod' && (
                          <button
                            onClick={() => setQuickVerifyOrder(order)}
                            style={{
                              padding: '5px 10px',
                              background: C.warningBg,
                              color: C.warningText,
                              border: `1px solid ${C.warningBorder}`,
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📷 Verify Proof
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActiveDetailOrder(order)
                            setCourierName(order.fulfillment?.courierName || 'TCS')
                            setTrackingNumber(order.fulfillment?.trackingNumber || '')
                            setTrackingUrl(order.fulfillment?.trackingUrl || '')
                          }}
                          style={{
                            ...btnSecondary,
                            padding: '5px 12px',
                            fontSize: '11px',
                          }}
                        >
                          👁 Details
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* QUICK PAYMENT PROOF VERIFICATION MODAL */}
      {quickVerifyOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 7, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              ...glassCard,
              maxWidth: '580px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              background: '#0d1714',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${C.border}`,
                paddingBottom: '14px',
                marginBottom: '18px',
              }}
            >
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: C.textGold }}>
                📷 Verify Payment: {quickVerifyOrder.orderNumber}
              </h2>
              <button
                onClick={() => setQuickVerifyOrder(null)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.borderInput}`,
                  borderRadius: '999px',
                  width: '30px',
                  height: '30px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: C.textSecondary,
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                marginBottom: '16px',
                background: C.inputBg,
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${C.borderInput}`,
              }}
            >
              <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', fontWeight: 800 }}>
                Customer Details
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: C.textPrimary, marginTop: '2px' }}>
                {quickVerifyOrder.customer?.name} ({quickVerifyOrder.customer?.city})
              </div>
              <div style={{ fontSize: '13px', color: C.pearl, marginTop: '2px' }}>
                Total: <strong>Rs. {quickVerifyOrder.totalAmount?.toLocaleString()}</strong>
              </div>
            </div>

            {/* TRX ID Box */}
            <div
              style={{
                background: C.infoBg,
                border: `1px solid ${C.infoBorder}`,
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: C.infoText, fontWeight: 800, textTransform: 'uppercase' }}>
                  Transaction / Reference ID
                </span>
                <div style={{ fontSize: '17px', fontWeight: 900, fontFamily: 'monospace', color: C.textPrimary, marginTop: '2px' }}>
                  {quickVerifyOrder.paymentProof?.transactionId || 'No TRX ID provided'}
                </div>
              </div>
              {quickVerifyOrder.paymentProof?.transactionId && (
                <button
                  onClick={() => handleCopy(quickVerifyOrder.paymentProof!.transactionId!, 'TRX ID')}
                  style={{
                    padding: '6px 12px',
                    background: C.gold,
                    color: '#0a1210',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  📋 Copy TRX
                </button>
              )}
            </div>

            {/* Screenshot Viewer */}
            {getMediaUrl(quickVerifyOrder.paymentProof?.screenshot) ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: C.textSecondary, fontWeight: 700, marginBottom: '8px' }}>
                  Payment Proof Screenshot (Click to enlarge):
                </div>
                <img
                  src={getMediaUrl(quickVerifyOrder.paymentProof?.screenshot)!}
                  alt="Payment Proof"
                  onClick={() => setLightboxImage(getMediaUrl(quickVerifyOrder.paymentProof?.screenshot))}
                  style={{
                    width: '100%',
                    maxHeight: '340px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: `1px solid ${C.border}`,
                    cursor: 'zoom-in',
                    background: '#050807',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  background: C.dangerBg,
                  border: `1px dashed ${C.dangerBorder}`,
                  borderRadius: '8px',
                  color: C.dangerText,
                  marginBottom: '20px',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                ⚠️ No screenshot image uploaded by customer.
              </div>
            )}

            {/* Approve / Reject Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus([quickVerifyOrder.id], 'confirmed')}
                style={{
                  padding: '12px',
                  background: '#10b981',
                  color: '#0a1210',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                ✓ Approve &amp; Confirm
              </button>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus([quickVerifyOrder.id], 'cancelled')}
                style={{
                  padding: '12px',
                  background: C.dangerBg,
                  color: C.dangerText,
                  border: `1px solid ${C.dangerBorder}`,
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                ✕ Reject &amp; Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-COLUMN VISUAL ORDER DETAIL VIEW MODAL */}
      {activeDetailOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 7, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              ...glassCard,
              maxWidth: '1080px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '28px',
              background: '#0d1714',
            }}
          >
            {/* DETAIL HEADER */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${C.border}`,
                paddingBottom: '16px',
                marginBottom: '24px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2
                    style={{
                      fontSize: '22px',
                      fontWeight: 900,
                      margin: 0,
                      fontFamily: 'monospace',
                      color: C.textGoldBright,
                    }}
                  >
                    Order {activeDetailOrder.orderNumber}
                  </h2>
                  <StatusBadge status={activeDetailOrder.status} />
                </div>
                <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>
                  Placed on {new Date(activeDetailOrder.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setActiveDetailOrder(null)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.borderInput}`,
                  borderRadius: '999px',
                  width: '34px',
                  height: '34px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: C.textSecondary,
                }}
              >
                ✕
              </button>
            </div>

            {/* 2-COLUMN LAYOUT */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                gap: '24px',
              }}
            >
              {/* LEFT COLUMN: Items & Payment Proof */}
              <div>
                <div
                  style={{
                    background: C.inputBg,
                    borderRadius: '10px',
                    border: `1px solid ${C.borderInput}`,
                    padding: '16px',
                    marginBottom: '20px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 14px 0',
                      color: C.textGold,
                      letterSpacing: '0.05em',
                    }}
                  >
                    Order Items ({activeDetailOrder.items?.length || 0})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeDetailOrder.items?.map((item, idx) => {
                      const prodTitle =
                        typeof item.product === 'object' ? item.product?.title : 'Product'
                      const prodImage =
                        typeof item.product === 'object'
                          ? getMediaUrl(item.product?.images?.[0]?.image || item.product?.media)
                          : null
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center',
                            background: 'rgba(10, 18, 16, 0.6)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${C.border}`,
                          }}
                        >
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              background: C.cardBgSolid,
                              borderRadius: '6px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              border: `1px solid ${C.border}`,
                            }}
                          >
                            {prodImage ? (
                              <img
                                src={prodImage}
                                alt={prodTitle}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '100%',
                                  fontSize: '20px',
                                }}
                              >
                                👗
                              </div>
                            )}
                          </div>
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.textPrimary }}>
                              {prodTitle}
                            </div>
                            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>
                              Size: <strong style={{ color: C.textGold }}>{item.variantSize}</strong>{' '}
                              {item.variantSku && `| SKU: ${item.variantSku}`}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: C.textSecondary,
                                marginTop: '2px',
                              }}
                            >
                              Rs. {(item.unitPrice || 0).toLocaleString()} × {item.quantity}
                            </div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: C.textPrimary }}>
                            Rs. {((item.unitPrice || 0) * item.quantity).toLocaleString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Payment Proof Card (Condition: Non-COD) */}
                {activeDetailOrder.paymentMethod !== 'cod' && (
                  <div
                    style={{
                      background: C.inputBg,
                      border: `1px solid ${C.border}`,
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        margin: '0 0 12px 0',
                        color: C.textGold,
                        letterSpacing: '0.05em',
                      }}
                    >
                      💳 Payment Verification
                    </h3>

                    {/* TRX ID Box */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(10, 18, 16, 0.6)',
                        border: `1px solid ${C.border}`,
                        borderRadius: '6px',
                        padding: '10px 14px',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '10px', color: C.textMuted, fontWeight: 800 }}>
                          SUBMITTED TRX / REF ID
                        </div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            color: C.textGoldBright,
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{activeDetailOrder.paymentProof?.transactionId || 'None Provided'}</span>
                          <StanBadge trxId={activeDetailOrder.paymentProof?.transactionId} />
                        </div>
                      </div>
                      {activeDetailOrder.paymentProof?.transactionId && (
                        <button
                          onClick={() =>
                            handleCopy(activeDetailOrder.paymentProof!.transactionId!, 'TRX ID')
                          }
                          style={{
                            padding: '6px 12px',
                            background: C.gold,
                            color: '#0a1210',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          📋 Copy
                        </button>
                      )}
                    </div>

                    {/* Lightbox Trigger */}
                    {getMediaUrl(activeDetailOrder.paymentProof?.screenshot) ? (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary, marginBottom: '6px' }}>
                          Proof Screenshot (Click to enlarge):
                        </div>
                        <img
                          src={getMediaUrl(activeDetailOrder.paymentProof?.screenshot)!}
                          alt="Proof Screenshot"
                          onClick={() => setLightboxImage(getMediaUrl(activeDetailOrder.paymentProof?.screenshot))}
                          style={{
                            width: '100%',
                            maxHeight: '280px',
                            objectFit: 'contain',
                            borderRadius: '6px',
                            border: `1px solid ${C.border}`,
                            cursor: 'zoom-in',
                            background: '#050807',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '14px',
                          background: C.dangerBg,
                          color: C.dangerText,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        ⚠️ No screenshot attached.
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                      <button
                        disabled={updating}
                        onClick={() => handleUpdateStatus([activeDetailOrder.id], 'confirmed')}
                        style={{
                          padding: '10px',
                          background: '#10b981',
                          color: '#0a1210',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Approve Payment
                      </button>
                      <button
                        disabled={updating}
                        onClick={() => handleUpdateStatus([activeDetailOrder.id], 'cancelled')}
                        style={{
                          padding: '10px',
                          background: C.dangerBg,
                          color: C.dangerText,
                          border: `1px solid ${C.dangerBorder}`,
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Reject &amp; Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Customer, Courier & Actions */}
              <div>
                {/* Status Control */}
                <div
                  style={{
                    background: C.inputBg,
                    border: `1px solid ${C.border}`,
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '18px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: C.textGold,
                      display: 'block',
                      marginBottom: '6px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Change Order Status
                  </label>
                  <select
                    value={activeDetailOrder.status}
                    onChange={(e) => handleUpdateStatus([activeDetailOrder.id], e.target.value)}
                    disabled={updating}
                    style={{
                      ...inputStyle,
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="pending_verification">⏳ Pending Verification</option>
                    <option value="confirmed">✓ Confirmed</option>
                    <option value="processing">⚙ Processing</option>
                    <option value="shipped">🚚 Shipped</option>
                    <option value="delivered">🎉 Delivered</option>
                    <option value="cancelled">✕ Cancelled (Restores Stock)</option>
                  </select>
                </div>

                {/* Customer Info */}
                <div
                  style={{
                    background: C.inputBg,
                    borderRadius: '10px',
                    border: `1px solid ${C.borderInput}`,
                    padding: '16px',
                    marginBottom: '18px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 10px 0',
                      color: C.textGold,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Customer &amp; Shipping Address
                  </h3>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: C.textPrimary }}>
                    {activeDetailOrder.customer?.name}
                  </div>
                  <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '2px' }}>
                    {activeDetailOrder.customer?.email}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <a
                      href={`https://wa.me/${(activeDetailOrder.customer?.phone || '').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '6px 10px',
                        background: '#25d366',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      💬 WhatsApp
                    </a>
                    <a
                      href={`tel:${activeDetailOrder.customer?.phone}`}
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      📞 Call {activeDetailOrder.customer?.phone}
                    </a>
                  </div>

                  <div
                    style={{
                      borderTop: `1px solid ${C.borderSubtle}`,
                      marginTop: '12px',
                      paddingTop: '10px',
                      fontSize: '12px',
                      color: C.pearl,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Address:</strong> {activeDetailOrder.customer?.address}
                    <br />
                    <strong>City:</strong> {activeDetailOrder.customer?.city}, {activeDetailOrder.customer?.province}
                  </div>
                </div>

                {/* Shipping / Courier */}
                <div
                  style={{
                    background: C.inputBg,
                    borderRadius: '10px',
                    border: `1px solid ${C.borderInput}`,
                    padding: '16px',
                    marginBottom: '18px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 10px 0',
                      color: C.purpleText,
                      letterSpacing: '0.04em',
                    }}
                  >
                    🚚 Courier &amp; Tracking Info
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary }}>Courier Service</label>
                      <select
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        style={{ ...inputStyle, marginTop: '4px' }}
                      >
                        <option value="TCS">TCS Express</option>
                        <option value="Leopard">Leopard Courier</option>
                        <option value="CallCourier">CallCourier</option>
                        <option value="Trax">Trax Logistics</option>
                        <option value="M&P">M&amp;P Courier</option>
                        <option value="PostEx">PostEx</option>
                        <option value="Other">Other / Rider</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary }}>Tracking Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 7820192831"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        style={{ ...inputStyle, marginTop: '4px' }}
                      />
                    </div>

                    <button
                      disabled={updating || !trackingNumber.trim()}
                      onClick={() =>
                        handleUpdateStatus([activeDetailOrder.id], 'shipped', {
                          courierName,
                          trackingNumber,
                          trackingUrl,
                        })
                      }
                      style={{
                        padding: '10px',
                        background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: trackingNumber.trim() ? 'pointer' : 'not-allowed',
                        opacity: trackingNumber.trim() ? 1 : 0.6,
                      }}
                    >
                      🚀 Attach Tracking &amp; Mark Shipped
                    </button>
                  </div>
                </div>

                {/* Financial Summary */}
                <div
                  style={{
                    background: C.inputBg,
                    borderRadius: '10px',
                    border: `1px solid ${C.borderInput}`,
                    padding: '16px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 10px 0',
                      color: C.textGold,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Financial Summary
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: C.textMuted }}>Items Subtotal:</span>
                    <span>Rs. {(activeDetailOrder.subtotal || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: C.textMuted }}>Shipping Fee:</span>
                    <span>Rs. {(activeDetailOrder.shippingFee || 0).toLocaleString()}</span>
                  </div>
                  {activeDetailOrder.codFee ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: C.textMuted }}>COD Fee:</span>
                      <span>Rs. {activeDetailOrder.codFee.toLocaleString()}</span>
                    </div>
                  ) : null}
                  <div
                    style={{
                      borderTop: `1px solid ${C.border}`,
                      paddingTop: '8px',
                      marginTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '15px',
                      fontWeight: 900,
                      color: C.textGoldBright,
                    }}
                  >
                    <span>Total Amount:</span>
                    <span>Rs. {(activeDetailOrder.totalAmount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX VIEWER */}
      {lightboxImage && (
        <div
          onClick={() => {
            setLightboxImage(null)
            setZoomScale(1)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 7, 0.95)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '8px',
              background: 'rgba(20, 31, 28, 0.95)',
              padding: '8px 16px',
              borderRadius: '999px',
              border: `1px solid ${C.border}`,
              zIndex: 10001,
            }}
          >
            <button
              onClick={() => setZoomScale((s) => Math.min(s + 0.5, 4))}
              style={{
                background: C.gold,
                color: '#0a1210',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Zoom +
            </button>
            <button
              onClick={() => setZoomScale((s) => Math.max(s - 0.5, 0.5))}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Zoom -
            </button>
            <button
              onClick={() => setZoomScale(1)}
              style={{
                background: 'transparent',
                color: C.pearl,
                border: `1px solid ${C.borderInput}`,
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reset ({Math.round(zoomScale * 100)}%)
            </button>
          </div>

          <div style={{ overflow: 'auto', maxWidth: '95vw', maxHeight: '85vh' }}>
            <img
              src={lightboxImage}
              alt="Payment Proof"
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '10px',
                transform: `scale(${zoomScale})`,
                transition: 'transform 0.2s ease-in-out',
                transformOrigin: 'center center',
              }}
            />
          </div>

          <button
            onClick={() => {
              setLightboxImage(null)
              setZoomScale(1)
            }}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: C.cardBgSolid,
              border: `1px solid ${C.border}`,
              borderRadius: '999px',
              width: '40px',
              height: '40px',
              fontSize: '18px',
              fontWeight: 900,
              color: C.pearl,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
