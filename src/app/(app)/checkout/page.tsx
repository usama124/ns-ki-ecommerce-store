import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import { getPayload } from 'payload'
import config from '@payload-config'
import { closedPaymentSettings, isStorefrontPaymentMethod } from '@/utilities/storefrontPayments'
import { getCodCoverage } from '@/utilities/instaworldCities'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Checkout | N's KI Pakistani Luxury Fashion",
  description:
    'Complete your purchase using one of our available payment methods.',
}

export default async function Checkout() {
  // Checkout availability must not use a stale public-global cache.
  const payload = await getPayload({ config }).catch(() => null)
  const siteSettings = await payload?.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false }).catch(() => closedPaymentSettings) || closedPaymentSettings
  const codCoverage = payload && isStorefrontPaymentMethod('cod', siteSettings) ? await getCodCoverage(payload).catch(() => null) : null
  return <CheckoutPage siteSettings={siteSettings} codCoverage={codCoverage} />
}
