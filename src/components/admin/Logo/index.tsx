import React from 'react'

export default function AdminLogo() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '12px 0',
        userSelect: 'none',
      }}
    >
      {/* Brand wordmark - Platinum / Metallic Silver */}
      <span
        style={{
          fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '0.35em',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 45%, #94A3B8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textTransform: 'uppercase',
          lineHeight: 1.1,
        }}
      >
        LUJAIN
      </span>
      {/* Sub-badge */}
      <span
        style={{
          display: 'inline-block',
          fontSize: '7px',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: '#94A3B8',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          padding: '2px 8px',
          borderRadius: '2px',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
          background: 'rgba(15, 23, 21, 0.4)',
        }}
      >
        ADMINISTRATION
      </span>
    </div>
  )
}
