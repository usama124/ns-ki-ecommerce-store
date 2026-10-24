'use client'

/** Persist only a digest and random capability, never delivery details. */
export async function getCheckoutRetryKey(details: unknown) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(details)),
  )
  const hash = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const slot = `nski:checkout:v1:${hash}`
  const existing = sessionStorage.getItem(slot)
  const key = existing || crypto.randomUUID()
  if (!existing) sessionStorage.setItem(slot, key)
  return { key, clear: () => sessionStorage.removeItem(slot) }
}
