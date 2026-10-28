'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function ReportsNavLink() {
  const active = usePathname()?.startsWith('/store-admin/reports')
  return (
    <div style={{ padding: '0 var(--base)' }}>
      <Link
        href="/store-admin/reports"
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'block',
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 4,
          color: 'var(--color-base-1000)',
          background: active ? 'var(--color-base-100)' : 'transparent',
          textDecoration: 'none',
        }}
      >
        Reports
      </Link>
    </div>
  )
}
