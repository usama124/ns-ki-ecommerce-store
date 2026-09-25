'use client'

import { toast } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'
import {
  C,
  glassCard,
  pageWrap,
  btnPrimary,
  btnSecondary,
  inputStyle,
  TH,
  TD,
} from '../adminTheme'

export type InventoryRow = {
  productId: string
  productTitle: string
  productSlug: string
  productStatus: string
  color: string | null
  primaryCategory: string
  primaryCategorySlug: string
  imageUrl: string | null
  variantIndex: number
  sizeName: string
  sku: string
  stock: number
  allowBackorder: boolean
  pricePKR: number
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode
  color: 'green' | 'amber' | 'red' | 'purple'
}) {
  const map: Record<string, React.CSSProperties> = {
    green: { background: C.successBg, color: C.successText, border: `1px solid ${C.successBorder}` },
    amber: { background: C.warningBg, color: C.warningText, border: `1px solid ${C.warningBorder}` },
    red: { background: C.dangerBg, color: C.dangerText, border: `1px solid ${C.dangerBorder}` },
    purple: { background: C.purpleBg, color: C.purpleText, border: `1px solid ${C.purpleBorder}` },
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        ...map[color],
      }}
    >
      {children}
    </span>
  )
}

export function InventoryViewClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [threshold, setThreshold] = useState<number>(5)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'low_stock' | 'out_of_stock' | 'backorder'>(
    'all',
  )
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [batchSaving, setBatchSaving] = useState(false)

  const fetchInventory = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load inventory')
      setInventory(data.inventory || [])
      setEditedStocks({})
    } catch (err: any) {
      setError(err?.message || 'Error loading inventory data')
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const stats = useMemo(() => {
    const totalVariants = inventory.length
    const totalUnits = inventory.reduce(
      (sum, item) => sum + (editedStocks[`${item.productId}-${item.variantIndex}`] ?? item.stock),
      0,
    )
    const lowStockCount = inventory.filter((item) => {
      const s = editedStocks[`${item.productId}-${item.variantIndex}`] ?? item.stock
      return s > 0 && s <= threshold
    }).length
    const outOfStockCount = inventory.filter((item) => {
      const s = editedStocks[`${item.productId}-${item.variantIndex}`] ?? item.stock
      return s === 0 && !item.allowBackorder
    }).length
    const backorderCount = inventory.filter((item) => item.allowBackorder).length
    return { totalVariants, totalUnits, lowStockCount, outOfStockCount, backorderCount }
  }, [inventory, editedStocks, threshold])

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const s = editedStocks[`${item.productId}-${item.variantIndex}`] ?? item.stock
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        if (
          !item.productTitle.toLowerCase().includes(q) &&
          !item.sku.toLowerCase().includes(q) &&
          !item.sizeName.toLowerCase().includes(q) &&
          !item.primaryCategory.toLowerCase().includes(q)
        )
          return false
      }
      if (filterTab === 'low_stock') return s > 0 && s <= threshold
      if (filterTab === 'out_of_stock') return s === 0
      if (filterTab === 'backorder') return item.allowBackorder
      return true
    })
  }, [inventory, editedStocks, searchQuery, filterTab, threshold])

  const handleStockChange = (productId: string, variantIndex: number, newStock: number) => {
    setEditedStocks((prev) => ({
      ...prev,
      [`${productId}-${variantIndex}`]: Math.max(0, Math.floor(newStock)),
    }))
  }

  const handleSaveSingle = async (item: InventoryRow) => {
    const key = `${item.productId}-${item.variantIndex}`
    const newStock = editedStocks[key]
    if (newStock === undefined || newStock === item.stock) return
    setSavingKey(key)
    try {
      const res = await fetch('/api/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          variantIndex: item.variantIndex,
          stock: newStock,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update stock')
      setInventory((prev) =>
        prev.map((i) =>
          i.productId === item.productId && i.variantIndex === item.variantIndex
            ? { ...i, stock: newStock }
            : i,
        ),
      )
      setEditedStocks((prev) => {
        const n = { ...prev }
        delete n[key]
        return n
      })
      toast.success(`Updated: ${item.productTitle} (${item.sizeName}) → ${newStock}`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stock')
    } finally {
      setSavingKey(null)
    }
  }

  const handleBatchSave = async () => {
    const dirtyKeys = Object.keys(editedStocks)
    if (!dirtyKeys.length) return
    setBatchSaving(true)
    const updates = dirtyKeys.map((key) => {
      const [productId, vIdxStr] = key.split('-')
      return { productId, variantIndex: Number(vIdxStr), stock: editedStocks[key] }
    })
    try {
      const res = await fetch('/api/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Batch update failed')
      setInventory((prev) =>
        prev.map((item) => {
          const k = `${item.productId}-${item.variantIndex}`
          return editedStocks[k] !== undefined ? { ...item, stock: editedStocks[k] } : item
        }),
      )
      setEditedStocks({})
      toast.success(`Saved ${updates.length} stock update(s)!`)
    } catch (err: any) {
      toast.error(err?.message || 'Batch save failed')
    } finally {
      setBatchSaving(false)
    }
  }

  const dirtyCount = Object.keys(editedStocks).length

  const tabBtn = (active: boolean, variant?: 'amber' | 'red'): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '7px 14px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderRadius: '8px',
      border: '1px solid transparent',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      transition: 'all 0.15s ease',
    }
    if (active && variant === 'amber') return { ...base, background: C.warningBg, color: C.warningText, border: `1px solid ${C.warningBorder}` }
    if (active && variant === 'red') return { ...base, background: C.dangerBg, color: C.dangerText, border: `1px solid ${C.dangerBorder}` }
    if (active) return { ...base, background: C.goldDim, color: C.gold, border: `1px solid ${C.border}` }
    if (variant === 'amber') return { ...base, background: 'transparent', color: C.warningText, border: `1px solid ${C.warningBorder}` }
    if (variant === 'red') return { ...base, background: 'transparent', color: C.dangerText, border: `1px solid ${C.dangerBorder}` }
    return { ...base, background: 'transparent', color: C.textSecondary, border: `1px solid ${C.borderInput}` }
  }

  return (
    <div style={pageWrap}>
      {/* Header Bar */}
      <div
        style={{
          ...glassCard,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>📦</span>
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: C.gold,
              }}
            >
              LUJAIN Stock Hub
            </p>
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em' }}>
            Inventory &amp; Stock Control
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.textSecondary }}>
            Real-time multi-variant inventory management and quick inline stock adjustments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btnSecondary} onClick={fetchInventory} disabled={loading}>
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
          {dirtyCount > 0 && (
            <button
              style={{
                ...btnPrimary,
                background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
                color: '#fff',
              }}
              onClick={handleBatchSave}
              disabled={batchSaving}
            >
              💾 {batchSaving ? 'Saving…' : `Save Changes (${dirtyCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          {
            label: 'Total Variants',
            value: stats.totalVariants,
            color: C.textPrimary,
            bg: C.cardBg,
            border: C.border,
            tab: 'all' as const,
          },
          {
            label: 'In-Stock Units',
            value: stats.totalUnits.toLocaleString(),
            color: C.textGoldBright,
            bg: C.cardBg,
            border: C.border,
            tab: 'all' as const,
          },
          {
            label: `⚠ Low (≤${threshold})`,
            value: stats.lowStockCount,
            color: C.warningText,
            bg: filterTab === 'low_stock' ? C.warningBg : C.cardBg,
            border: filterTab === 'low_stock' ? C.warningBorder : C.border,
            tab: 'low_stock' as const,
          },
          {
            label: '✕ Out of Stock',
            value: stats.outOfStockCount,
            color: C.dangerText,
            bg: filterTab === 'out_of_stock' ? C.dangerBg : C.cardBg,
            border: filterTab === 'out_of_stock' ? C.dangerBorder : C.border,
            tab: 'out_of_stock' as const,
          },
        ].map(({ label, value, color, bg, border, tab }) => (
          <div
            key={label}
            onClick={() => setFilterTab(tab)}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: '12px',
              padding: '18px',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: C.shadowCard,
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color,
                marginBottom: '8px',
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          ...glassCard,
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={tabBtn(filterTab === 'all')} onClick={() => setFilterTab('all')}>
            All ({stats.totalVariants})
          </button>
          <button
            style={tabBtn(filterTab === 'low_stock', 'amber')}
            onClick={() => setFilterTab('low_stock')}
          >
            ⚠ Low ({stats.lowStockCount})
          </button>
          <button
            style={tabBtn(filterTab === 'out_of_stock', 'red')}
            onClick={() => setFilterTab('out_of_stock')}
          >
            ✕ Out of Stock ({stats.outOfStockCount})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              background: C.inputBg,
              border: `1px solid ${C.borderInput}`,
              borderRadius: '8px',
              padding: '6px 12px',
            }}
          >
            <span style={{ fontWeight: 600, color: C.textSecondary, whiteSpace: 'nowrap' }}>
              Low Alert Threshold:
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: '42px',
                textAlign: 'center',
                fontWeight: 700,
                border: `1px solid ${C.borderInput}`,
                borderRadius: '4px',
                padding: '3px 4px',
                fontSize: '12px',
                color: C.textPrimary,
                background: 'rgba(0,0,0,0.3)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: C.textMuted,
                fontSize: '13px',
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Search product, SKU, size…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '240px',
                padding: '8px 12px 8px 32px',
                fontSize: '12px',
                border: `1px solid ${C.borderInput}`,
                borderRadius: '8px',
                outline: 'none',
                background: C.inputBg,
                color: C.textPrimary,
              }}
            />
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div
        style={{
          ...glassCard,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>
            Loading inventory items…
          </div>
        ) : error ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.dangerText, fontSize: '13px' }}>
            {error}
          </div>
        ) : filteredInventory.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>
            No inventory items match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={TH}>Product</th>
                  <th style={TH}>Category / Color</th>
                  <th style={TH}>Size &amp; SKU</th>
                  <th style={TH}>Status</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Stock Qty</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const key = `${item.productId}-${item.variantIndex}`
                  const currentStock = editedStocks[key] ?? item.stock
                  const isDirty =
                    editedStocks[key] !== undefined && editedStocks[key] !== item.stock
                  const isSavingThis = savingKey === key
                  const isLow = currentStock > 0 && currentStock <= threshold
                  const isOut = currentStock === 0 && !item.allowBackorder
                  const rowBg = isOut ? C.rowOut : isLow ? C.rowLow : 'transparent'

                  return (
                    <tr
                      key={key}
                      style={{
                        background: rowBg,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isOut && !isLow) e.currentTarget.style.background = C.rowHover
                      }}
                      onMouseLeave={(e) => {
                        if (!isOut && !isLow) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '52px',
                              background: C.cardBgSolid,
                              borderRadius: '6px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              border: `1px solid ${C.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productTitle}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: '9px', color: C.textMuted }}>LUJAIN</span>
                            )}
                          </div>
                          <div>
                            <a
                              href={`/store-admin/collections/products/${item.productId}`}
                              style={{
                                fontWeight: 700,
                                color: C.textPrimary,
                                textDecoration: 'none',
                                fontSize: '13px',
                                display: 'block',
                                lineHeight: 1.3,
                              }}
                            >
                              {item.productTitle}
                            </a>
                            <span
                              style={{
                                fontSize: '10px',
                                color: C.textMuted,
                                fontFamily: 'monospace',
                              }}
                            >
                              ID: {item.productId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <Badge color="amber">{item.primaryCategory}</Badge>
                          {item.color && (
                            <span style={{ fontSize: '11px', color: C.textSecondary }}>
                              Color: <strong style={{ color: C.textPrimary }}>{item.color}</strong>
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={TD}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '12px',
                            color: C.textGoldBright,
                            textTransform: 'uppercase',
                            marginBottom: '2px',
                          }}
                        >
                          {item.sizeName}
                        </div>
                        <div
                          style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textMuted }}
                        >
                          {item.sku}
                        </div>
                      </td>
                      <td style={TD}>
                        {isOut ? (
                          <Badge color="red">✕ Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge color="amber">⚠ Low ({currentStock})</Badge>
                        ) : item.allowBackorder && currentStock <= 0 ? (
                          <Badge color="purple">Backorder</Badge>
                        ) : (
                          <Badge color="green">✓ In Stock ({currentStock})</Badge>
                        )}
                      </td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            border: `1px solid ${C.borderInput}`,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: C.inputBg,
                          }}
                        >
                          <button
                            onClick={() =>
                              handleStockChange(item.productId, item.variantIndex, currentStock - 1)
                            }
                            style={{
                              width: '30px',
                              height: '30px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 700,
                              color: C.textPrimary,
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={currentStock}
                            onChange={(e) =>
                              handleStockChange(
                                item.productId,
                                item.variantIndex,
                                Number(e.target.value) || 0,
                              )
                            }
                            style={{
                              width: '56px',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              color: C.textPrimary,
                            }}
                          />
                          <button
                            onClick={() =>
                              handleStockChange(item.productId, item.variantIndex, currentStock + 1)
                            }
                            style={{
                              width: '30px',
                              height: '30px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 700,
                              color: C.textPrimary,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {isDirty ? (
                          <button
                            style={{
                              ...btnPrimary,
                              padding: '6px 14px',
                              fontSize: '11px',
                            }}
                            onClick={() => handleSaveSingle(item)}
                            disabled={isSavingThis}
                          >
                            {isSavingThis ? 'Saving…' : '💾 Save'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: C.textMuted, fontStyle: 'italic' }}>
                            Saved
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: C.textMuted, textAlign: 'right' }}>
        Showing {filteredInventory.length} of {stats.totalVariants} variants
      </div>
    </div>
  )
}
