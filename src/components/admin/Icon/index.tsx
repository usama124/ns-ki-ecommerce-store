import React from 'react'

export default function AdminIcon() {
  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        background: 'linear-gradient(135deg, #0A1210 0%, #12221C 100%)',
        border: '1px solid rgba(226, 232, 240, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
          fontSize: '16px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 50%, #94A3B8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        L
      </span>
    </div>
  )
}
