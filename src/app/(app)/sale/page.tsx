import { getSalePriceDetails } from '@/utilities/getSalePrice'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'

import { SalePageClient } from './SalePageClient'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const payload = await getPayload({ config })
    const saleSettings: any = await payload.findGlobal({
      slug: 'sale-settings' as any,
    })

    return {
      title: saleSettings?.title ? `${saleSettings.title} | LUJAIN` : 'Flash Sale | LUJAIN',
      description:
        saleSettings?.announcementText || 'Limited-time exclusive luxury flash sale offers.',
    }
  } catch {
    return {
      title: 'Flash Sale | LUJAIN',
      description: 'Limited-time exclusive luxury flash sale offers.',
    }
  }
}

export default async function SalePage() {
  const payload = await getPayload({ config })

  let saleSettings: any = null
  try {
    saleSettings = await payload.findGlobal({
      slug: 'sale-settings' as any,
      depth: 2,
    })
  } catch (e: any) {
    console.warn('sale-settings table not yet initialized:', e?.message || e)
  }

  let productsDocs: any[] = []
  try {
    const productsRes = await payload.find({
      collection: 'products',
      where: {
        status: { equals: 'published' },
      },
      limit: 200,
      depth: 2,
    })
    productsDocs = productsRes.docs
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

  const now = Date.now()
  const start = saleSettings?.startDate ? new Date(saleSettings.startDate).getTime() : 0
  const end = saleSettings?.endDate ? new Date(saleSettings.endDate).getTime() : Infinity
  const isLive = Boolean(saleSettings?.isActive && now >= start && now <= end)

  return (
    <SalePageClient
      isLive={isLive}
      saleSettings={saleSettings}
      initialProducts={onSaleProducts}
      subcategories={subcategories}
    />
  )
}
