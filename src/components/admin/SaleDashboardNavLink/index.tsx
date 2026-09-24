'use client'

import { usePathname } from 'next/navigation'

/**
 * Rendered inside the Payload admin sidebar via admin.components.afterNavLinks.
 */
export function SaleDashboardNavLink() {
  const pathname = usePathname()
  const isActive = pathname?.startsWith('/store-admin/sale-dashboard') ?? false

  return (
    <div style={{ padding: '0 var(--base)' }}>
      <a
        href="/store-admin/sale-dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: isActive ? 'var(--color-base-1000)' : 'var(--color-base-800)',
          background: isActive ? 'var(--color-base-100)' : 'transparent',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLAnchorElement
          if (!isActive) el.style.background = 'var(--color-base-100)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLAnchorElement
          if (!isActive) el.style.background = 'transparent'
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>🏷️</span>
        Flash Sale Management
      </a>
    </div>
  )
}

