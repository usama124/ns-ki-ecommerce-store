'use client'

import { toast } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

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
      bg: '#fffbeb',
      color: '#b45309',
      border: '#fde68a',
      icon: '⏳',
      label: 'Pending Verification',
    },
    confirmed: {
      bg: '#f0fdf4',
      color: '#15803d',
      border: '#bbf7d0',
      icon: '✓',
      label: 'Confirmed',
    },
    processing: {
      bg: '#f0f9ff',
      color: '#0369a1',
      border: '#bae6fd',
      icon: '⚙',
      label: 'Processing',
    },
    shipped: { bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff', icon: '🚚', label: 'Shipped' },
    delivered: {
      bg: '#ecfdf5',
      color: '#047857',
      border: '#a7f3d0',
      icon: '🎉',
      label: 'Delivered',
    },
    cancelled: {
      bg: '#fff1f2',
      color: '#be123c',
      border: '#fecdd3',
      icon: '✕',
      label: 'Cancelled',
    },
  }
  const config = map[status] || {
    bg: '#f3f4f6',
    color: '#374151',
    border: '#d1d5db',
    icon: '•',
    label: status,
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
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
  const map: Record<string, { bg: string; color: string; icon: string; label: string }> = {
    cod: { bg: '#f1f5f9', color: '#334155', icon: '💵', label: 'COD' },
    bank_transfer: { bg: '#e0f2fe', color: '#0369a1', icon: '🏦', label: 'Bank / Raast' },
    jazzcash: { bg: '#fef3c7', color: '#92400e', icon: '📱', label: 'JazzCash' },
    easypaisa: { bg: '#dcfce7', color: '#15803d', icon: '📲', label: 'EasyPaisa' },
  }
  const config = map[method] || { bg: '#f1f5f9', color: '#334155', icon: '💳', label: method }

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
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
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

  // Copy helper
  const handleCopy = (text: string, label: string = 'TRX ID') => {
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${label} to clipboard!`)
  }

  // Media URL helper
  const getMediaUrl = (media: any): string | null => {
    if (!media) return null
    if (typeof media === 'string') return media
    if (typeof media === 'object' && media.url) {
      return media.url
    }
    return null
  }

  const tabs = [
    { id: 'all', label: 'All Orders', count: stats.totalOrders, color: '#3b82f6' },
    {
      id: 'pending_verification',
      label: '⏳ Pending Verification',
      count: stats.pendingVerification,
      color: '#d97706',
    },
    { id: 'confirmed', label: '✓ Confirmed', count: stats.confirmed, color: '#16a34a' },
    { id: 'processing', label: '⚙ Processing', count: stats.processing, color: '#0284c7' },
    { id: 'shipped', label: '🚚 Shipped', count: stats.shipped, color: '#9333ea' },
    { id: 'delivered', label: '🎉 Delivered', count: stats.delivered, color: '#0d9488' },
    { id: 'cancelled', label: '✕ Cancelled', count: stats.cancelled, color: '#e11d48' },
  ]

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* HEADER HERO CARD */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          borderRadius: '16px',
          padding: '24px 32px',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🛒</span>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Orders & Fulfillment Dashboard
            </h1>
          </div>
          <p style={{ margin: '6px 0 0 38px', fontSize: '14px', color: '#94a3b8' }}>
            Real-time status tracking, payment proof verification, and automated stock restoration.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>🔄</span> Refresh Data
        </button>
      </div>

      {/* TOP METRICS & STATS CARDS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Total Orders */}
        <div
          style={{
            background: '#ffffff',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#64748b',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Lifetime Orders
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#0f172a' }}>
            {stats.totalOrders}
          </div>
        </div>

        {/* Pending Verification - Amber Glow */}
        <div
          style={{
            background: stats.pendingVerification > 0 ? '#fffbeb' : '#ffffff',
            padding: '18px',
            borderRadius: '14px',
            border: stats.pendingVerification > 0 ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            boxShadow:
              stats.pendingVerification > 0
                ? '0 10px 20px -5px rgba(245, 158, 11, 0.2)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '11px',
                color: '#b45309',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Pending Verification
            </span>
            {stats.pendingVerification > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  fontWeight: 900,
                }}
              >
                ACTION NEEDED
              </span>
            )}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#92400e' }}>
            {stats.pendingVerification}
          </div>
        </div>

        {/* Confirmed */}
        <div
          style={{
            background: '#f0fdf4',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #bbf7d0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#166534',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Confirmed
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#15803d' }}>
            {stats.confirmed}
          </div>
        </div>

        {/* Processing */}
        <div
          style={{
            background: '#f0f9ff',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #bae6fd',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#075985',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Processing
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#0369a1' }}>
            {stats.processing}
          </div>
        </div>

        {/* Shipped */}
        <div
          style={{
            background: '#faf5ff',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #e9d5ff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#6b21a8',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Shipped
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#7e22ce' }}>
            {stats.shipped}
          </div>
        </div>

        {/* Delivered */}
        <div
          style={{
            background: '#ecfdf5',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #a7f3d0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#065f46',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Delivered
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#047857' }}>
            {stats.delivered}
          </div>
        </div>

        {/* Cancelled */}
        <div
          style={{
            background: '#fff1f2',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #fecdd3',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#9f1239',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Cancelled
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '6px', color: '#be123c' }}>
            {stats.cancelled}
          </div>
        </div>

        {/* Total Revenue */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            padding: '18px',
            borderRadius: '14px',
            border: '1px solid #6ee7b7',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#065f46',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Total Revenue
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, marginTop: '6px', color: '#047857' }}>
            Rs. {stats.totalRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* INDIVIDUAL SEPARATE FILTER TABS WITH REAL-TIME COUNTS */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px 14px 0 0',
          border: '1px solid #e2e8f0',
          borderBottom: 'none',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: isActive ? '2px solid ' + tab.color : '1px solid #e2e8f0',
                  background: isActive ? tab.color : '#ffffff',
                  color: isActive ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 4px 12px -2px ' + tab.color + '40' : 'none',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#475569',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '280px' }}>
          <input
            type="text"
            placeholder="🔍 Search Order #, Name, Phone, TRX ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              background: '#f8fafc',
            }}
          />
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e40af' }}>
            ✓ {selectedIds.length} orders selected for batch operation
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={updating}
              onClick={() => handleUpdateStatus(selectedIds, 'confirmed')}
              style={{
                padding: '8px 16px',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
              }}
            >
              ✓ Bulk Confirm Orders
            </button>
            <button
              disabled={updating}
              onClick={() => handleUpdateStatus(selectedIds, 'cancelled')}
              style={{
                padding: '8px 16px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
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
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0 0 14px 14px',
          overflowX: 'auto',
          boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05)',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            ⏳ Loading orders data...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: '#e11d48',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            ⚠️ {error}
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            No orders found for the selected status tab.
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
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 18px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === orders.length && orders.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 800, color: '#334155' }}>Order #</th>
                <th style={{ padding: '14px 18px', fontWeight: 800, color: '#334155' }}>
                  Customer & City
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 800, color: '#334155' }}>
                  Payment Method
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 800, color: '#334155' }}>Status</th>
                <th style={{ padding: '14px 18px', fontWeight: 800, color: '#334155' }}>
                  Total Amount
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 800, color: '#334155' }}>
                  Date Placed
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    fontWeight: 800,
                    color: '#334155',
                    textAlign: 'right',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background:
                        order.status === 'pending_verification' ? '#fffdf0' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => handleToggleSelect(order.id)}
                      />
                    </td>
                    <td
                      style={{
                        padding: '14px 18px',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: '#0f172a',
                      }}
                    >
                      {order.orderNumber}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>
                        {order.customer?.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {order.customer?.city}, {order.customer?.province}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <PaymentMethodBadge method={order.paymentMethod} />
                      {order.paymentProof?.transactionId && (
                        <div
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#2563eb',
                            marginTop: '3px',
                            fontWeight: 700,
                          }}
                        >
                          TRX: {order.paymentProof.transactionId}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 800, color: '#0f172a' }}>
                      Rs. {(order.totalAmount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '12px' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {order.paymentMethod !== 'cod' && (
                          <button
                            onClick={() => setQuickVerifyOrder(order)}
                            style={{
                              padding: '6px 12px',
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
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
                            padding: '6px 12px',
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          👁 View Detail
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
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: '#0f172a' }}>
                📷 Verify Payment: {quickVerifyOrder.orderNumber}
              </h2>
              <button
                onClick={() => setQuickVerifyOrder(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '999px',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                marginBottom: '16px',
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Customer Details
              </div>
              <div
                style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}
              >
                {quickVerifyOrder.customer?.name} ({quickVerifyOrder.customer?.city})
              </div>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                Total Amount: <strong>Rs. {quickVerifyOrder.totalAmount?.toLocaleString()}</strong>
              </div>
            </div>

            {/* TRX ID Box */}
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#0369a1',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  Transaction / Reference ID
                </span>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    color: '#0c4a6e',
                    marginTop: '2px',
                  }}
                >
                  {quickVerifyOrder.paymentProof?.transactionId || 'No TRX ID provided'}
                </div>
              </div>
              {quickVerifyOrder.paymentProof?.transactionId && (
                <button
                  onClick={() =>
                    handleCopy(quickVerifyOrder.paymentProof!.transactionId!, 'TRX ID')
                  }
                  style={{
                    padding: '8px 14px',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  📋 Copy TRX ID
                </button>
              )}
            </div>

            {/* Screenshot Viewer */}
            {getMediaUrl(quickVerifyOrder.paymentProof?.screenshot) ? (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#475569',
                    fontWeight: 800,
                    marginBottom: '8px',
                  }}
                >
                  Uploaded Payment Proof Screenshot (Click to enlarge):
                </div>
                <img
                  src={getMediaUrl(quickVerifyOrder.paymentProof?.screenshot)!}
                  alt="Payment Proof"
                  onClick={() =>
                    setLightboxImage(getMediaUrl(quickVerifyOrder.paymentProof?.screenshot))
                  }
                  style={{
                    width: '100%',
                    maxHeight: '380px',
                    objectFit: 'contain',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    cursor: 'zoom-in',
                    background: '#0f172a',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: '#fff1f2',
                  border: '1px dashed #fecdd3',
                  borderRadius: '10px',
                  color: '#be123c',
                  marginBottom: '24px',
                  fontWeight: 700,
                }}
              >
                ⚠️ No screenshot image uploaded by customer.
              </div>
            )}

            {/* Approve / Reject Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus([quickVerifyOrder.id], 'confirmed')}
                style={{
                  padding: '14px',
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                }}
              >
                ✓ Approve & Confirm Order
              </button>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus([quickVerifyOrder.id], 'cancelled')}
                style={{
                  padding: '14px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                }}
              >
                ✕ Reject & Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENHANCED 2-COLUMN VISUAL ORDER DETAIL VIEW MODAL */}
      {activeDetailOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '1120px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* DETAIL HEADER */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '18px',
                marginBottom: '24px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2
                    style={{
                      fontSize: '24px',
                      fontWeight: 900,
                      margin: 0,
                      fontFamily: 'monospace',
                      color: '#0f172a',
                    }}
                  >
                    Order {activeDetailOrder.orderNumber}
                  </h2>
                  <StatusBadge status={activeDetailOrder.status} />
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Placed on {new Date(activeDetailOrder.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setActiveDetailOrder(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '999px',
                  width: '36px',
                  height: '36px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: '#475569',
                }}
              >
                ✕
              </button>
            </div>

            {/* 2-COLUMN LAYOUT */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
                gap: '28px',
              }}
            >
              {/* LEFT COLUMN: Visual Items & Payment Proof */}
              <div>
                {/* Product Line Items */}
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '18px',
                    marginBottom: '20px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 16px 0',
                      color: '#0f172a',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Order Line Items ({activeDetailOrder.items?.length || 0})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                            gap: '14px',
                            alignItems: 'center',
                            background: '#ffffff',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              width: '64px',
                              height: '64px',
                              background: '#f1f5f9',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              flexShrink: 0,
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
                                  fontSize: '24px',
                                }}
                              >
                                👗
                              </div>
                            )}
                          </div>
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                              {prodTitle}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              Size: <strong>{item.variantSize}</strong>{' '}
                              {item.variantSku && `| SKU: ${item.variantSku}`}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 800,
                                color: '#0284c7',
                                marginTop: '4px',
                              }}
                            >
                              Rs. {(item.unitPrice || 0).toLocaleString()} × {item.quantity}
                            </div>
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
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
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '12px',
                      padding: '18px',
                      marginBottom: '20px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        margin: '0 0 14px 0',
                        color: '#92400e',
                        letterSpacing: '0.04em',
                      }}
                    >
                      💳 Manual Payment Proof Verification
                    </h3>

                    {/* TRX ID Box */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #fcd34d',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '14px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 800 }}>
                          SUBMITTED TRX / REF ID
                        </div>
                        <div
                          style={{
                            fontSize: '17px',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            color: '#78350f',
                            marginTop: '2px',
                          }}
                        >
                          {activeDetailOrder.paymentProof?.transactionId || 'None Provided'}
                        </div>
                      </div>
                      {activeDetailOrder.paymentProof?.transactionId && (
                        <button
                          onClick={() =>
                            handleCopy(activeDetailOrder.paymentProof!.transactionId!, 'TRX ID')
                          }
                          style={{
                            padding: '8px 14px',
                            background: '#d97706',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          📋 Copy TRX ID
                        </button>
                      )}
                    </div>

                    {/* Lightbox Trigger */}
                    {getMediaUrl(activeDetailOrder.paymentProof?.screenshot) ? (
                      <div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#92400e',
                            marginBottom: '8px',
                          }}
                        >
                          Proof Screenshot (Click to enlarge):
                        </div>
                        <img
                          src={getMediaUrl(activeDetailOrder.paymentProof?.screenshot)!}
                          alt="Proof Screenshot"
                          onClick={() =>
                            setLightboxImage(
                              getMediaUrl(activeDetailOrder.paymentProof?.screenshot),
                            )
                          }
                          style={{
                            width: '100%',
                            maxHeight: '320px',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            border: '1px solid #fde68a',
                            cursor: 'zoom-in',
                            background: '#0f172a',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '16px',
                          background: '#fff1f2',
                          color: '#be123c',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 800,
                        }}
                      >
                        ⚠️ Customer did not attach a screenshot proof file.
                      </div>
                    )}

                    {/* Side-by-Side Verification Actions */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginTop: '16px',
                      }}
                    >
                      <button
                        disabled={updating}
                        onClick={() => handleUpdateStatus([activeDetailOrder.id], 'confirmed')}
                        style={{
                          padding: '12px',
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Approve Payment
                      </button>
                      <button
                        disabled={updating}
                        onClick={() => handleUpdateStatus([activeDetailOrder.id], 'cancelled')}
                        style={{
                          padding: '12px',
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Reject & Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Customer, Shipping & Status Control */}
              <div>
                {/* Status Control Panel */}
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '2px solid #0284c7',
                    borderRadius: '12px',
                    padding: '18px',
                    marginBottom: '20px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#0369a1',
                      display: 'block',
                      marginBottom: '8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Transition Order Status
                  </label>
                  <select
                    value={activeDetailOrder.status}
                    onChange={(e) => handleUpdateStatus([activeDetailOrder.id], e.target.value)}
                    disabled={updating}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      fontSize: '14px',
                      fontWeight: 800,
                      background: '#ffffff',
                      color: '#0369a1',
                      outline: 'none',
                    }}
                  >
                    <option value="pending_verification">⏳ Pending Verification</option>
                    <option value="confirmed">✓ Confirmed</option>
                    <option value="processing">⚙ Processing</option>
                    <option value="shipped">🚚 Shipped</option>
                    <option value="delivered">🎉 Delivered</option>
                    <option value="cancelled">✕ Cancelled (Restores Stock)</option>
                  </select>
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      fontSize: '11px',
                      color: '#0284c7',
                      fontWeight: 600,
                    }}
                  >
                    💡 Note: Setting status to <strong>Cancelled</strong> automatically restores
                    variant stock back to inventory.
                  </p>
                </div>

                {/* Customer & Delivery Info Card */}
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '18px',
                    marginBottom: '20px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 14px 0',
                      color: '#0f172a',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Customer & Shipping Address
                  </h3>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    {activeDetailOrder.customer?.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {activeDetailOrder.customer?.email}
                  </div>

                  {/* WhatsApp / Phone Links */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <a
                      href={`https://wa.me/${(activeDetailOrder.customer?.phone || '').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '8px 12px',
                        background: '#25d366',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}
                    >
                      💬 WhatsApp Customer
                    </a>
                    <a
                      href={`tel:${activeDetailOrder.customer?.phone}`}
                      style={{
                        padding: '8px 12px',
                        background: '#3b82f6',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}
                    >
                      📞 Call {activeDetailOrder.customer?.phone}
                    </a>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      marginTop: '14px',
                      paddingTop: '14px',
                      fontSize: '13px',
                      color: '#334155',
                    }}
                  >
                    <strong>Street Address:</strong> {activeDetailOrder.customer?.address}
                    <br />
                    <strong>City & Province:</strong> {activeDetailOrder.customer?.city},{' '}
                    {activeDetailOrder.customer?.province}
                  </div>
                </div>

                {/* Shipping & Tracking Section */}
                <div
                  style={{
                    background: '#faf5ff',
                    borderRadius: '12px',
                    border: '1px solid #e9d5ff',
                    padding: '18px',
                    marginBottom: '20px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 14px 0',
                      color: '#6b21a8',
                      letterSpacing: '0.04em',
                    }}
                  >
                    🚚 Courier & Tracking Info
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#7e22ce' }}>
                        Courier Service
                      </label>
                      <select
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px',
                          borderRadius: '6px',
                          border: '1px solid #d8b4fe',
                          fontSize: '13px',
                          marginTop: '4px',
                        }}
                      >
                        <option value="TCS">TCS Express</option>
                        <option value="Leopard">Leopard Courier</option>
                        <option value="CallCourier">CallCourier</option>
                        <option value="Trax">Trax Logistics</option>
                        <option value="M&P">M&P Courier</option>
                        <option value="PostEx">PostEx</option>
                        <option value="Other">Other / Rider</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#7e22ce' }}>
                        Tracking Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 7820192831"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px',
                          borderRadius: '6px',
                          border: '1px solid #d8b4fe',
                          fontSize: '13px',
                          marginTop: '4px',
                        }}
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
                        background: '#9333ea',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: trackingNumber.trim() ? 'pointer' : 'not-allowed',
                        opacity: trackingNumber.trim() ? 1 : 0.6,
                        boxShadow: '0 4px 12px rgba(147, 51, 234, 0.25)',
                      }}
                    >
                      🚀 Attach Tracking & Mark Shipped
                    </button>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '18px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      margin: '0 0 14px 0',
                      color: '#0f172a',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Financial Summary
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>Items Subtotal:</span>
                    <span>Rs. {(activeDetailOrder.subtotal || 0).toLocaleString()}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>
                      Shipping Fee ({activeDetailOrder.customer?.city}):
                    </span>
                    <span>Rs. {(activeDetailOrder.shippingFee || 0).toLocaleString()}</span>
                  </div>
                  {activeDetailOrder.codFee ? (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ color: '#64748b' }}>COD Service Charge:</span>
                      <span>Rs. {activeDetailOrder.codFee.toLocaleString()}</span>
                    </div>
                  ) : null}
                  <div
                    style={{
                      borderTop: '1px solid #cbd5e1',
                      paddingTop: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '17px',
                      fontWeight: 900,
                      color: '#0f172a',
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

      {/* FULLSCREEN LIGHTBOX IMAGE VIEWER */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxImage}
            alt="Expanded Payment Proof"
            style={{
              maxWidth: '95vw',
              maxHeight: '95vh',
              objectFit: 'contain',
              borderRadius: '12px',
            }}
          />
          <button
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              fontWeight: 900,
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
