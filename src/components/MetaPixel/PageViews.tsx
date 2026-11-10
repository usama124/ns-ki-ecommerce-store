'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

declare global {
  interface Window {
    __nskiMetaInitialized?: boolean
    __nskiMetaPath?: string
    fbq?: (...args: unknown[]) => void
  }
}

/** The base code owns the initial view; this handles Next.js soft navigation. */
export function MetaPixelPageViews() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname || !window.__nskiMetaInitialized || !window.fbq || window.__nskiMetaPath === pathname) return
    window.__nskiMetaPath = pathname
    window.fbq('track', 'PageView')
  }, [pathname])
  return null
}
