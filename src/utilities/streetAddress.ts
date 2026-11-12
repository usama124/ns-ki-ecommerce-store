/** Allow ordinary multiline addresses, not arbitrary control characters/markup. */
export function normalizeStreetAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\r\n?/g, '\n')
  // Keep LF only; tabs, NUL, escape sequences and other C0 controls stay invalid.
  if (normalized.length > 500 || /[\u0000-\u0009\u000b-\u001f<>]/.test(normalized)) return null
  return normalized.trim() || null
}
