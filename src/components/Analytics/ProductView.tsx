'use client'
import { useEffect, useRef } from 'react'
import { useAnalyticsReady } from '@/lib/analytics/hooks'
import { productItem } from '@/lib/analytics/model'
import { track } from '@/lib/analytics/client'
export function ProductView({ product }: { product: Parameters<typeof productItem>[0] }) {
  const ready = useAnalyticsReady(),
    viewed = useRef('')
  useEffect(() => {
    const item = productItem(product)
    if (ready && item && viewed.current !== item.item_id) {
      viewed.current = item.item_id
      track('view_item', [item])
    }
  }, [ready, product])
  return null
}
