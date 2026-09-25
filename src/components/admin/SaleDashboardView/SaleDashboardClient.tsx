'use client'

import { toast } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'
import { C, glassCard, pageWrap, btnPrimary, btnDanger, btnSecondary, inputStyle, TH, TD } from '../adminTheme'

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
    if (!endDate || !isActive) { setTimeLeft(''); return }
    const interval = setInterval(() => {
      const diff = new Date(endDate).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Expired'); setIsLive(false); clearInterval(interval); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [endDate, isActive])

  const handleCategoryToggle = (catId: string) => {
    setTargetedCategories(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId])
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await fetch('/api/admin/sale-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive, title, startDate: startDate ? new Date(startDate).toISOString() : null, endDate: endDate ? new Date(endDate).toISOString() : null, discountPercentage, targetedCategories, announcementText, enablePopup }),
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
      const res = await fetch('/api/admin/sale-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end_immediately' }) })
      if (!res.ok) throw new Error('Failed to terminate sale')
      toast.success('Flash sale terminated immediately!')
      setIsActive(false); setIsLive(false)
      fetchDashboardData()
    } catch (err: any) {
      toast.error(err.message || 'Error ending sale')
    } finally {
      setEnding(false)
    }
  }

  if (loading) {
    return (
      <div style={{ ...pageWrap, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏷️</div>
          <p style={{ color: C.textMuted, fontSize: '14px' }}>Loading Flash Sale Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={pageWrap}>

      {/* ── TOP BAR ── */}
      <div style={{ ...glassCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '20px 24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.02em' }}>
            🏷️ Flash Sale Campaign Management
          </h1>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px',
            borderRadius: '999px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            backgroundColor: isLive ? C.successBg : C.goldDim,
            color: isLive ? C.successText : C.textMuted,
            border: `1px solid ${isLive ? C.successBorder : C.border}`,
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isLive ? '#34d399' : C.slate, boxShadow: isLive ? '0 0 8px #34d399' : 'none' }} />
            {isLive ? 'LIVE' : 'INACTIVE'}
          </span>
          {isLive && timeLeft && (
            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', background: C.goldDim, color: C.gold, border: `1px solid ${C.border}` }}>
              ⏱ {timeLeft}
            </span>
          )}
        </div>
        {isLive && (
          <button type="button" onClick={handleEndImmediately} disabled={ending} style={btnDanger}>
            {ending ? 'Ending Sale...' : '🔴 End Sale Immediately'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* ── CAMPAIGN FORM ── */}
        <form onSubmit={handleSaveSettings} style={{ ...glassCard, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: C.textGold, letterSpacing: '0.04em' }}>
            ⚙️ Campaign Configuration
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* Status toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Campaign Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isActive ? C.successBorder : C.borderInput}`, background: isActive ? C.successBg : C.inputBg }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#34d399' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: isActive ? C.successText : C.textSecondary }}>
                  {isActive ? '✓ Sale Active' : 'Sale Disabled'}
                </span>
              </label>
            </div>

            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Campaign Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mid-Summer Clearance" required style={inputStyle} />
            </div>

            {/* Discount */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Discount %</label>
              <input type="number" min={1} max={99} value={discountPercentage} onChange={e => setDiscountPercentage(Number(e.target.value))} required style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Start Datetime</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>End Datetime</label>
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
          </div>

          {/* Categories */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Targeted Categories ({targetedCategories.length} selected)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', borderRadius: '8px', border: `1px solid ${C.borderInput}`, background: C.inputBg, maxHeight: '160px', overflowY: 'auto' }}>
              {categories.length === 0 && <span style={{ fontSize: '12px', color: C.textMuted }}>No categories found</span>}
              {categories.map(cat => {
                const checked = targetedCategories.includes(cat.id)
                return (
                  <button key={cat.id} type="button" onClick={() => handleCategoryToggle(cat.id)} style={{
                    padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    border: checked ? `1px solid ${C.gold}` : `1px solid ${C.borderInput}`,
                    background: checked ? C.goldDim : 'transparent',
                    color: checked ? C.gold : C.textSecondary,
                  }}>
                    {checked ? '✓ ' : ''}{cat.name}{cat.parent ? ` (${cat.parent})` : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Announcement */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Announcement Banner Text</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={enablePopup} onChange={e => setEnablePopup(e.target.checked)} style={{ accentColor: C.gold }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary }}>Show Banner</span>
              </label>
            </div>
            <textarea rows={2} value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="🔥 FLASH SALE LIVE! Enjoy up to 20% OFF on selected collections." style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>

          <div>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : '💾 Save Sale Settings'}
            </button>
          </div>
        </form>

        {/* ── ACTIVE PRODUCTS TABLE ── */}
        <div style={{ ...glassCard, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: C.textGold }}>
              📦 On-Sale Products ({activeProducts.length})
            </h2>
            <span style={{ fontSize: '12px', color: C.textMuted }}>Products receiving discount based on selected categories</span>
          </div>

          {activeProducts.length === 0 ? (
            <p style={{ fontSize: '13px', color: C.textMuted, margin: 0, padding: '24px', textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: '8px' }}>
              No active products found. Select categories and enable sale above.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={TH}>Product</th>
                    <th style={TH}>Category</th>
                    <th style={TH}>Base Price (PKR)</th>
                    <th style={TH}>Sale Price (PKR)</th>
                    <th style={TH}>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProducts.map(p => (
                    <tr key={p.id} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ ...TD, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {p.image ? (
                          <img src={p.image} alt={p.title} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', border: `1px solid ${C.border}` }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: C.cardBgSolid, border: `1px solid ${C.border}` }} />
                        )}
                        <span style={{ fontWeight: 600, color: C.textPrimary }}>{p.title}</span>
                      </td>
                      <td style={TD}><span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: C.goldDim, color: C.gold, border: `1px solid ${C.border}` }}>{p.primaryCategory}</span></td>
                      <td style={{ ...TD, textDecoration: 'line-through', color: C.textMuted }}>Rs. {p.basePricePKR?.toLocaleString()}</td>
                      <td style={{ ...TD, fontWeight: 700, color: C.dangerText }}>Rs. {p.effectivePrice?.toLocaleString()}</td>
                      <td style={TD}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: C.dangerBg, color: C.dangerText, border: `1px solid ${C.dangerBorder}` }}>
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
