'use client'
import { useEffect, useRef } from 'react'
import { useAnalyticsReady } from '@/lib/analytics/hooks'
import { track } from '@/lib/analytics/client'
import { cartItems } from '@/lib/analytics/model'
export function CheckoutView({ items }: { items: Parameters<typeof cartItems>[0] }) {
  const ready = useAnalyticsReady(),
    sent = useRef(false)
  useEffect(() => {
    if (ready && items.length && !sent.current) {
      sent.current = true
      track('begin_checkout', cartItems(items))
    }
  }, [ready, items])
  return null
}
