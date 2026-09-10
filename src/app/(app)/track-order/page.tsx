import React from 'react'
import type { Metadata } from 'next'
import { OrderTrackingView } from '@/components/orders/OrderTrackingView'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Track Order | N's KI Pakistani Luxury Fashion",
  description:
    'Track your N\'s KI luxury fashion order status, payment verification, and courier dispatch in real time.',
  openGraph: mergeOpenGraph({
    title: 'Track Order',
    url: '/track-order',
  }),
}

export default function TrackOrderPage() {
  return <OrderTrackingView />
}
