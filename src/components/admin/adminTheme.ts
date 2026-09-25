/**
 * LUJAIN Admin Panel — Shared Design Tokens
 * Dark Emerald + Metallic Gold + Pearl Silver glassmorphism theme
 */

export const C = {
  // Backgrounds
  bg: '#0a1210',
  bgDeep: '#050807',
  cardBg: 'rgba(20, 31, 28, 0.85)',
  cardBgSolid: '#101f1b',
  inputBg: 'rgba(15, 23, 21, 0.7)',
  rowHover: 'rgba(212, 175, 55, 0.04)',
  rowLow: 'rgba(245, 158, 11, 0.08)',
  rowOut: 'rgba(239, 68, 68, 0.08)',

  // Borders
  border: 'rgba(212, 175, 55, 0.18)',
  borderHover: 'rgba(212, 175, 55, 0.45)',
  borderInput: 'rgba(100, 134, 152, 0.3)',
  borderSubtle: 'rgba(255,255,255,0.07)',

  // Text
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#648698',
  textGold: '#d4af37',
  textGoldBright: '#f3e5ab',

  // Accents
  gold: '#d4af37',
  goldDim: 'rgba(212, 175, 55, 0.08)',
  goldGlow: '0 0 15px rgba(212, 175, 55, 0.12)',
  slate: '#648698',
  pearl: '#cbccc7',

  // Status (semantic but adjusted for dark bg)
  successBg: 'rgba(16, 185, 129, 0.12)',
  successText: '#34d399',
  successBorder: 'rgba(16, 185, 129, 0.3)',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningText: '#fbbf24',
  warningBorder: 'rgba(245, 158, 11, 0.3)',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  dangerText: '#f87171',
  dangerBorder: 'rgba(239, 68, 68, 0.3)',
  infoBg: 'rgba(59, 130, 246, 0.12)',
  infoText: '#60a5fa',
  infoBorder: 'rgba(59, 130, 246, 0.3)',
  purpleBg: 'rgba(139, 92, 246, 0.12)',
  purpleText: '#a78bfa',
  purpleBorder: 'rgba(139, 92, 246, 0.3)',

  // Shadows
  shadow: '0 8px 32px rgba(0,0,0,0.4)',
  shadowCard: '0 4px 24px rgba(0,0,0,0.3)',
}

/** Glassmorphism card style */
export const glassCard: React.CSSProperties = {
  background: C.cardBg,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
  boxShadow: C.shadow,
}

/** Standard page wrapper */
export const pageWrap: React.CSSProperties = {
  padding: '24px',
  minHeight: '100%',
  background: `radial-gradient(circle at top left, #12211c 0%, #0a1210 60%, #050807 100%)`,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: C.textPrimary,
}

/** Gold gradient primary button */
export const btnPrimary: React.CSSProperties = {
  padding: '9px 20px',
  background: 'linear-gradient(135deg, #b8860b 0%, #d4af37 55%, #f3e5ab 100%)',
  color: '#0a1210',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '0.04em',
  transition: 'opacity 0.2s',
}

/** Ghost secondary button */
export const btnSecondary: React.CSSProperties = {
  padding: '9px 20px',
  background: 'transparent',
  color: C.pearl,
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
}

/** Danger button */
export const btnDanger: React.CSSProperties = {
  padding: '9px 20px',
  background: 'rgba(239, 68, 68, 0.15)',
  color: '#f87171',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s',
}

/** Table header cell */
export const TH: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  background: 'rgba(10, 18, 16, 0.6)',
  borderBottom: `1px solid rgba(212, 175, 55, 0.15)`,
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: C.textMuted,
  whiteSpace: 'nowrap',
}

/** Table data cell */
export const TD: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid rgba(255,255,255,0.04)`,
  verticalAlign: 'middle',
  color: C.textPrimary,
}

/** Dark-theme input style */
export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '7px',
  border: `1px solid ${C.borderInput}`,
  background: C.inputBg,
  color: C.textPrimary,
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}
