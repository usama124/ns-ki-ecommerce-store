import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import { getPayload } from 'payload'
import config from '@payload-config'
import { closedPaymentSettings } from '@/utilities/storefrontPayments'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Checkout | N's KI Pakistani Luxury Fashion",
  description:
    'Complete your purchase using one of our available payment methods.',
}

export default async function Checkout() {
  // Checkout availability must not use a stale public-global cache.
  const siteSettings = await getPayload({ config })
    .then(payload => payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false }))
    .catch(() => closedPaymentSettings)
  return <CheckoutPage siteSettings={siteSettings} />
}
