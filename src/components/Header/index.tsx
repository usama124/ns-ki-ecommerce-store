import { SalePopupBanner } from '@/components/navigation/SalePopupBanner'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getStorefrontCategories } from '@/utilities/getStorefrontCategories'

import { HeaderClient } from './index.client'
import './index.css'

export async function Header() {
  const [header, categories, siteSettings, saleSettings] = await Promise.all([
    getCachedGlobal('header', 1)(),
    getStorefrontCategories(),
    getCachedGlobal('site-settings', 0)().catch(() => null),
    getCachedGlobal('sale-settings', 0)().catch(() => null),
  ])
  const mainCategories = categories.filter((category) => category.type === 'main')
  const subcategories = categories.filter((category) => category.type === 'subcategory')

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
