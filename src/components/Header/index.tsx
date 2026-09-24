import { SalePopupBanner } from '@/components/navigation/SalePopupBanner'
import { getCachedGlobal } from '@/utilities/getGlobals'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { HeaderClient } from './index.client'
import './index.css'

export async function Header() {
  const header = await getCachedGlobal('header', 1)()

  // Fetch main categories with their subcategories for the mega-menu
  const payload = await getPayload({ config: configPromise })
  const categoriesResult = await payload.find({
    collection: 'categories',
    where: { type: { equals: 'main' } },
    sort: 'name',
    limit: 20,
    depth: 0,
  })

  const subcategoriesResult = await payload.find({
    collection: 'categories',
    where: { type: { equals: 'subcategory' } },
    sort: 'name',
    limit: 100,
    depth: 1,
  })

  // Fetch site settings for announcement bar
  let siteSettings: any = null
  try {
    siteSettings = await getCachedGlobal('site-settings', 1)()
  } catch {
    // site-settings global may not exist yet
  }

  // Fetch sale settings for storefront sale popup banner
  let saleSettings: any = null
  try {
    saleSettings = await getCachedGlobal('sale-settings' as any, 1)()
  } catch {
    // sale-settings global may not exist yet
  }

  const mainCategories = categoriesResult.docs
  const subcategories = subcategoriesResult.docs

  return (
    <>
      <SalePopupBanner saleSettings={saleSettings} />
      <HeaderClient
        header={header}
        mainCategories={mainCategories as any}
        subcategories={subcategories as any}
        announcementBar={siteSettings?.announcementBar}
      />
    </>
  )
}
