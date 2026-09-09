import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Checkout | N's KI Pakistani Luxury Fashion",
  description:
    'Complete your purchase with Cash on Delivery, Bank Transfer, JazzCash, or EasyPaisa.',
}

export default function Checkout() {
  return <CheckoutPage />
}
