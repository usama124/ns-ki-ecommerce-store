import React from 'react'

export default function AdminIcon() {
  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        background: 'linear-gradient(135deg, #0A1210 0%, #12221C 100%)',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(212,175,55,0.1)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
          fontSize: '16px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #D4AF37 0%, #F3E5AB 55%, #B8860B 100%)',
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
