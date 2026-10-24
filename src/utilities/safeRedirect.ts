/** Return only a local path; never feed an untrusted URL or scheme to router.push. */
export function safeRedirect(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback
  try {
    // Reject encoded separators/control characters too, including nested encoding.
    let decoded = value
    for (let i = 0; i < 5; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback
    const url = new URL(value, 'https://redirect.invalid')
    return url.origin === 'https://redirect.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch { return fallback }
}
