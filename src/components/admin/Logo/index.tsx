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
      {/* Brand wordmark */}
      <span
        style={{
          fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '0.35em',
          background: 'linear-gradient(135deg, #D4AF37 0%, #F3E5AB 50%, #B8860B 100%)',
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
          color: '#648698',
          border: '1px solid rgba(100, 134, 152, 0.4)',
          padding: '2px 8px',
          borderRadius: '2px',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 500,
        }}
      >
        ADMINISTRATION
      </span>
    </div>
  )
}
