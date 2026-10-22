'use client'
import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import { useCallback, useRef } from 'react'

export const LivePreviewListener: React.FC = () => {
  const router = useRouter()
  const hasInitialized = useRef(false)
  const refresh = useCallback(() => {
    // The library calls refresh on mount as well as on document changes. A mount
    // refresh can remount a 404 boundary and repeat indefinitely.
    if (!hasInitialized.current) {
      hasInitialized.current = true
      return
    }
    router.refresh()
  }, [router])
  return (
    <RefreshRouteOnSave refresh={refresh} serverURL={process.env.NEXT_PUBLIC_SERVER_URL || ''} />
  )
}
