'use client'

import { toast } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'

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
    green: { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' },
    amber: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    red: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
    purple: { background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' },
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
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

  // ── styles ────────────────────────────────────────────────────────────────
  const btn = (variant: 'primary' | 'secondary' | 'save'): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      letterSpacing: '0.03em',
      transition: 'opacity 0.15s',
    }
    if (variant === 'primary') return { ...base, background: '#1c1917', color: '#fff' }
    if (variant === 'save') return { ...base, background: '#92400e', color: '#fff' }
    return { ...base, background: '#fff', color: '#44403c', border: '1px solid #d6d3d1' }
  }

  const tabBtn = (active: boolean, variant?: 'amber' | 'red'): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '6px 14px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderRadius: '6px',
      border: '1px solid transparent',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }
    if (active && variant === 'amber') return { ...base, background: '#92400e', color: '#fff' }
    if (active && variant === 'red') return { ...base, background: '#991b1b', color: '#fff' }
    if (active) return { ...base, background: '#1c1917', color: '#fff' }
    if (variant === 'amber')
      return { ...base, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }
    if (variant === 'red')
      return { ...base, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }
    return { ...base, background: '#f5f5f4', color: '#44403c' }
  }

  const TH: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    background: '#f5f5f4',
    borderBottom: '1px solid #e7e5e4',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#78716c',
    whiteSpace: 'nowrap',
  }
  const TD: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #f0eeee',
    verticalAlign: 'middle',
  }

  return (
    <div
      style={{
        padding: '24px',
        fontFamily: 'var(--font-body, sans-serif)',
        color: '#1c1917',
        background: '#fafaf9',
        minHeight: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e7e5e4',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#92400e',
              marginBottom: '4px',
            }}
          >
            📦 Payload Admin
          </p>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1c1917' }}>
            Inventory &amp; Stock Control
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#78716c' }}>
            Monitor stock levels, set low-stock threshold, and update quantities.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btn('secondary')} onClick={fetchInventory} disabled={loading}>
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
          {dirtyCount > 0 && (
            <button style={btn('save')} onClick={handleBatchSave} disabled={batchSaving}>
              💾 {batchSaving ? 'Saving…' : `Save All (${dirtyCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          {
            label: 'Total Variants',
            value: stats.totalVariants,
            color: '#1c1917',
            bg: '#fff',
            border: '#e7e5e4',
            tab: 'all' as const,
          },
          {
            label: 'In-Stock Units',
            value: stats.totalUnits.toLocaleString(),
            color: '#1c1917',
            bg: '#fff',
            border: '#e7e5e4',
            tab: 'all' as const,
          },
          {
            label: `⚠ Low (≤${threshold})`,
            value: stats.lowStockCount,
            color: '#92400e',
            bg: filterTab === 'low_stock' ? '#fef3c7' : '#fff',
            border: filterTab === 'low_stock' ? '#fcd34d' : '#e7e5e4',
            tab: 'low_stock' as const,
          },
          {
            label: '✕ Out of Stock',
            value: stats.outOfStockCount,
            color: '#991b1b',
            bg: filterTab === 'out_of_stock' ? '#fee2e2' : '#fff',
            border: filterTab === 'out_of_stock' ? '#fca5a5' : '#e7e5e4',
            tab: 'out_of_stock' as const,
          },
        ].map(({ label, value, color, bg, border, tab }) => (
          <div
            key={label}
            onClick={() => setFilterTab(tab)}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: '10px',
              padding: '16px',
              cursor: 'pointer',
              flex: '1 1 140px',
              minWidth: '130px',
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
            <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e7e5e4',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              background: '#f5f5f4',
              border: '1px solid #d6d3d1',
              borderRadius: '6px',
              padding: '6px 10px',
            }}
          >
            <span style={{ fontWeight: 600, color: '#57534e', whiteSpace: 'nowrap' }}>
              Low threshold:
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: '44px',
                textAlign: 'center',
                fontWeight: 700,
                border: '1px solid #d6d3d1',
                borderRadius: '4px',
                padding: '2px 4px',
                fontSize: '12px',
                color: '#1c1917',
                background: '#fff',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '9px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#a8a29e',
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
                width: '220px',
                padding: '7px 10px 7px 30px',
                fontSize: '12px',
                border: '1px solid #d6d3d1',
                borderRadius: '6px',
                outline: 'none',
                background: '#fff',
                color: '#1c1917',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e7e5e4',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#78716c', fontSize: '13px' }}>
            Loading inventory…
          </div>
        ) : error ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#991b1b', fontSize: '13px' }}>
            {error}
          </div>
        ) : filteredInventory.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#78716c', fontSize: '13px' }}>
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
                  <th style={{ ...TH, textAlign: 'center' }}>Stock</th>
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
                  const rowBg = isOut ? '#fff5f5' : isLow ? '#fffbeb' : '#fff'

                  return (
                    <tr key={key} style={{ background: rowBg }}>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '48px',
                              background: '#f5f5f4',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              border: '1px solid #e7e5e4',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
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
                              <span style={{ fontSize: '9px', color: '#a8a29e' }}>N's KI</span>
                            )}
                          </div>
                          <div>
                            <a
                              href={`/store-admin/collections/products/${item.productId}`}
                              style={{
                                fontWeight: 600,
                                color: '#1c1917',
                                textDecoration: 'none',
                                fontSize: '12px',
                                display: 'block',
                                lineHeight: 1.3,
                              }}
                            >
                              {item.productTitle}
                            </a>
                            <span
                              style={{
                                fontSize: '10px',
                                color: '#a8a29e',
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
                            <span style={{ fontSize: '11px', color: '#57534e' }}>
                              Color: <strong>{item.color}</strong>
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={TD}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            marginBottom: '2px',
                          }}
                        >
                          {item.sizeName}
                        </div>
                        <div
                          style={{ fontSize: '10px', fontFamily: 'monospace', color: '#78716c' }}
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
                            border: '1px solid #d6d3d1',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            background: '#fff',
                          }}
                        >
                          <button
                            onClick={() =>
                              handleStockChange(item.productId, item.variantIndex, currentStock - 1)
                            }
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 700,
                              color: '#44403c',
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
                              color: '#1c1917',
                            }}
                          />
                          <button
                            onClick={() =>
                              handleStockChange(item.productId, item.variantIndex, currentStock + 1)
                            }
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: 700,
                              color: '#44403c',
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {isDirty ? (
                          <button
                            style={btn('primary')}
                            onClick={() => handleSaveSingle(item)}
                            disabled={isSavingThis}
                          >
                            {isSavingThis ? 'Saving…' : '💾 Save'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#a8a29e', fontStyle: 'italic' }}>
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

      <div style={{ marginTop: '12px', fontSize: '11px', color: '#a8a29e', textAlign: 'right' }}>
        Showing {filteredInventory.length} of {stats.totalVariants} variants
      </div>
    </div>
  )
}
