'use client'

import { toast } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

export function SaleDashboardClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ending, setEnding] = useState(false)

  const [saleSettings, setSaleSettings] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [activeProducts, setActiveProducts] = useState<any[]>([])
  const [isLive, setIsLive] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  // Form states
  const [isActive, setIsActive] = useState(false)
  const [title, setTitle] = useState('Flash Sale')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [discountPercentage, setDiscountPercentage] = useState(20)
  const [targetedCategories, setTargetedCategories] = useState<string[]>([])
  const [announcementText, setAnnouncementText] = useState('')
  const [enablePopup, setEnablePopup] = useState(true)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/sale-settings')
      if (!res.ok) throw new Error('Failed to load sale settings')
      const data = await res.json()

      setSaleSettings(data.saleSettings)
      setCategories(data.categories || [])
      setActiveProducts(data.activeProducts || [])
      setIsLive(data.isLive || false)

      const s = data.saleSettings
      if (s) {
        setIsActive(Boolean(s.isActive))
        setTitle(s.title || 'Flash Sale')
        setStartDate(s.startDate ? new Date(s.startDate).toISOString().slice(0, 16) : '')
        setEndDate(s.endDate ? new Date(s.endDate).toISOString().slice(0, 16) : '')
        setDiscountPercentage(s.discountPercentage || 20)
        setTargetedCategories(
          Array.isArray(s.targetedCategories)
            ? s.targetedCategories.map((c: any) => (typeof c === 'object' ? c.id : c))
            : [],
        )
        setAnnouncementText(s.announcementText || '')
        setEnablePopup(s.enablePopup !== false)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Live countdown ticker
  useEffect(() => {
    if (!endDate || !isActive) {
      setTimeLeft('')
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const end = new Date(endDate).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft('Expired')
        setIsLive(false)
        clearInterval(interval)
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const secs = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
            .toString()
            .padStart(2, '0')}`,
        )
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endDate, isActive])

  const handleCategoryToggle = (catId: string) => {
    setTargetedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    )
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await fetch('/api/admin/sale-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive,
          title,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
          discountPercentage,
          targetedCategories,
          announcementText,
          enablePopup,
        }),
      })

      if (!res.ok) throw new Error('Failed to save sale settings')
      toast.success('Sale campaign settings updated successfully!')
      fetchDashboardData()
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleEndImmediately = async () => {
    if (!confirm('Are you sure you want to end the flash sale immediately?')) return
    try {
      setEnding(true)
      const res = await fetch('/api/admin/sale-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_immediately' }),
      })

      if (!res.ok) throw new Error('Failed to terminate sale')
      toast.success('Flash sale terminated immediately!')
      setIsActive(false)
      setIsLive(false)
      fetchDashboardData()
    } catch (err: any) {
      toast.error(err.message || 'Error ending sale')
    } finally {
      setEnding(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', fontFamily: 'sans-serif' }}>
        <p style={{ color: 'var(--color-base-600)' }}>Loading Flash Sale Dashboard...</p>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1280px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: 'var(--color-base-1000)',
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          backgroundColor: 'var(--color-base-100)',
          borderRadius: '12px',
          border: '1px solid var(--color-base-200)',
          marginBottom: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            🏷️ Flash Sale Campaign Management
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: isLive ? '#22c55e1a' : '#64748b1a',
                color: isLive ? '#15803d' : '#64748b',
                border: `1px solid ${isLive ? '#22c55e40' : '#64748b30'}`,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isLive ? '#22c55e' : '#94a3b8',
                  boxShadow: isLive ? '0 0 8px #22c55e' : 'none',
                }}
              />
              {isLive ? 'LIVE CAMPAIGN' : 'INACTIVE'}
            </span>

            {isLive && timeLeft && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--color-base-200)',
                  color: 'var(--color-base-900)',
                }}
              >
                ⏱️ {timeLeft}
              </span>
            )}
          </div>
        </div>

        {isLive && (
          <button
            type="button"
            onClick={handleEndImmediately}
            disabled={ending}
            style={{
              padding: '10px 18px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: ending ? 'not-allowed' : 'pointer',
              opacity: ending ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {ending ? 'Ending Sale...' : '🔴 End Sale Immediately'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '28px' }}>
        {/* CAMPAIGN FORM PANEL */}
        <form
          onSubmit={handleSaveSettings}
          style={{
            backgroundColor: 'var(--color-base-100)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--color-base-200)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
            ⚙️ Campaign Configuration
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Campaign Status
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Enable Flash Sale ({isActive ? 'Active' : 'Disabled'})
                </span>
              </label>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Campaign Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mid-Summer Clearance"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-base-300)',
                  backgroundColor: 'var(--color-base-0)',
                  color: 'inherit',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Discount Percentage (%)
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-base-300)',
                  backgroundColor: 'var(--color-base-0)',
                  color: 'inherit',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Start Datetime
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-base-300)',
                  backgroundColor: 'var(--color-base-0)',
                  color: 'inherit',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                End Datetime
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-base-300)',
                  backgroundColor: 'var(--color-base-0)',
                  color: 'inherit',
                }}
              />
            </div>
          </div>

          {/* TARGETED CATEGORIES MULTI-SELECT */}
          <div>
            <label
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}
            >
              Targeted Categories / Subcategories (Check all eligible)
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--color-base-300)',
                backgroundColor: 'var(--color-base-0)',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              {categories.map((cat) => {
                const isChecked = targetedCategories.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryToggle(cat.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: isChecked
                        ? '1px solid var(--color-base-800)'
                        : '1px solid var(--color-base-300)',
                      backgroundColor: isChecked
                        ? 'var(--color-base-900)'
                        : 'var(--color-base-100)',
                      color: isChecked ? 'var(--color-base-0)' : 'var(--color-base-800)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat.name} {cat.parent ? `(${cat.parent})` : ''} {isChecked ? '✓' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ANNOUNCEMENT TEXT & POPUP */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Storefront Announcement Banner Text</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={enablePopup}
                  onChange={(e) => setEnablePopup(e.target.checked)}
                />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Enable Alert Banner</span>
              </label>
            </div>
            <textarea
              rows={2}
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="🔥 FLASH SALE LIVE! Enjoy up to 20% OFF on selected collections."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-base-300)',
                backgroundColor: 'var(--color-base-0)',
                color: 'inherit',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--color-base-900)',
                color: 'var(--color-base-0)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : '💾 Save Sale Settings'}
            </button>
          </div>
        </form>

        {/* ACTIVE PRODUCTS MATRIX TABLE */}
        <div
          style={{
            backgroundColor: 'var(--color-base-100)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--color-base-200)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
              📦 Active On-Sale Products ({activeProducts.length})
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--color-base-600)' }}>
              Products receiving discount based on selected categories
            </span>
          </div>

          {activeProducts.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-base-600)', margin: 0 }}>
              No active products found matching the targeted sale categories. Select categories and enable sale above.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-base-300)' }}>
                    <th style={{ padding: '10px 12px' }}>Product</th>
                    <th style={{ padding: '10px 12px' }}>Category</th>
                    <th style={{ padding: '10px 12px' }}>Base Price (PKR)</th>
                    <th style={{ padding: '10px 12px' }}>Discounted Price (PKR)</th>
                    <th style={{ padding: '10px 12px' }}>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProducts.map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid var(--color-base-200)' }}
                    >
                      <td
                        style={{
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.title}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '4px',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--color-base-200)',
                            }}
                          />
                        )}
                        <span style={{ fontWeight: 600 }}>{p.title}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-base-700)' }}>
                        {p.primaryCategory}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textDecoration: 'line-through',
                          color: 'var(--color-base-600)',
                        }}
                      >
                        Rs. {p.basePricePKR.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 700,
                          color: '#dc2626',
                        }}
                      >
                        Rs. {p.effectivePrice.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                          }}
                        >
                          -{p.discountPercentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
