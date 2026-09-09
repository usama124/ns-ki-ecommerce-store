import type { Metadata } from 'next'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import { FindOrderForm } from '@/components/forms/FindOrderForm'

export const dynamic = 'force-dynamic'

export default async function FindOrderPage() {
  return (
    <div className="container py-16">
      <FindOrderForm />
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Find your order using your email and order ID.',
  openGraph: mergeOpenGraph({
    title: 'Find order',
    url: '/find-order',
  }),
  title: 'Find order',
}
