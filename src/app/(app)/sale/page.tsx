import { getSalePriceDetails } from '@/utilities/getSalePrice'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { productCardSelect } from '@/utilities/productCardSelect'

import { SalePageClient } from './SalePageClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const saleSettings = await getCachedGlobal('sale-settings', 0)()

    return {
      title: saleSettings?.title
        ? `${saleSettings.title} | Siblings by N’s KI`
        : 'Flash Sale | Siblings by N’s KI',
      description:
        saleSettings?.announcementText || 'Limited-time exclusive luxury flash sale offers.',
    }
  } catch {
    return {
      title: 'Flash Sale | Siblings by N’s KI',
      description: 'Limited-time exclusive luxury flash sale offers.',
    }
  }
}

export default async function SalePage() {
  const payload = await getPayload({ config })

  let saleSettings: any = null
  try {
    saleSettings = await getCachedGlobal('sale-settings', 0)()
  } catch (e: any) {
    console.warn('sale-settings table not yet initialized:', e?.message || e)
  }

  let productsDocs: any[] = []
  // Request-time campaign bounds must not be frozen into a static build.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const start = saleSettings?.startDate ? new Date(saleSettings.startDate).getTime() : 0
  const end = saleSettings?.endDate ? new Date(saleSettings.endDate).getTime() : Infinity
  const isLive = Boolean(saleSettings?.isActive && now >= start && now <= end)
  try {
    if (isLive && saleSettings?.targetedCategories?.length) {
      const productsRes = await payload.find({
        collection: 'products',
        where: {
          and: [
            { status: { equals: 'published' } },
            {
              or: [
                { primaryCategory: { in: saleSettings.targetedCategories } },
                { categories: { in: saleSettings.targetedCategories } },
              ],
            },
          ],
        },
        limit: 200,
        depth: 1,
        select: productCardSelect,
      })
      productsDocs = productsRes.docs
    }
  } catch (e: any) {
    console.warn('Could not fetch products for sale page:', e?.message || e)
  }

  // Compute sale details for all products
  const onSaleProducts = productsDocs
    .map((product: any) => {
      const saleDetails = getSalePriceDetails(product, saleSettings)
      return {
        ...product,
        salePriceDetails: saleDetails,
      }
    })
    .filter((p: any) => p.salePriceDetails.isOnSale)

  // Extract available subcategories for filter bar
  const subcategoryMap = new Map<string, { id: string; name: string }>()
  for (const product of onSaleProducts) {
    if (product.categories && Array.isArray(product.categories)) {
      for (const cat of product.categories) {
        if (typeof cat === 'object' && cat !== null) {
          subcategoryMap.set(String(cat.id), { id: String(cat.id), name: cat.name })
        }
      }
    }
  }

  const subcategories = Array.from(subcategoryMap.values())

  return (
    <SalePageClient
      isLive={isLive}
      saleSettings={saleSettings}
      initialProducts={onSaleProducts}
      subcategories={subcategories}
    />
  )
}
