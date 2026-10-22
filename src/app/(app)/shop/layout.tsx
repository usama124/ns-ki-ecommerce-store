import { Categories } from '@/components/layout/search/Categories'
import { FilterList } from '@/components/layout/search/filter'
import { sorting } from '@/lib/constants'
import { Search } from '@/components/Search'
import React, { Suspense } from 'react'
import { CollectionLayout } from '@/components/products/CollectionLayout'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <div className="container my-4 sm:my-6 pb-4">
        <CollectionLayout search={<Search />} filters={<><Categories /><FilterList list={sorting} title="Sort by" /></>}>
          {children}
        </CollectionLayout>
      </div>
    </Suspense>
  )
}
