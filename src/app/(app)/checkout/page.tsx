import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import { getCachedGlobal } from '@/utilities/getGlobals'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Checkout | N's KI Pakistani Luxury Fashion",
  description:
    'Complete your purchase with Cash on Delivery, Bank Transfer, JazzCash, or EasyPaisa.',
}

export default async function Checkout() {
  const siteSettings = await getCachedGlobal('site-settings', 1)().catch(() => null)
  return <CheckoutPage siteSettings={siteSettings} />
}
