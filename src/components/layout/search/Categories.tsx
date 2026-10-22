import { getStorefrontCategories } from '@/utilities/getStorefrontCategories'
import clsx from 'clsx'
import { Suspense } from 'react'

import { CategoryItem } from './Categories.client'

export async function CategoryList() {
  const categories = await getStorefrontCategories()
  const mainCategories = categories.filter(category => category.type === 'main')
  const subcategories = categories.filter(category => category.type === 'subcategory')

  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">
        Main Categories
      </h3>

      <ul>
        {mainCategories.map((category) => {
          return (
            <li key={category.id}>
              <CategoryItem category={category} />
            </li>
          )
        })}
      </ul>
      {subcategories.length > 0 && <section className="mt-6" aria-label="Subcategories">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 px-1">Subcategories</h3>
        <ul>{subcategories.map(category => {
          const parentId = typeof category.parent === 'object' ? category.parent?.id : category.parent
          const parent = mainCategories.find(main => String(main.id) === String(parentId))
          return <li key={category.id}>
            <CategoryItem category={category} />
            {parent && <span className="block px-3 pb-2 text-[10px] text-muted-foreground">{parent.name}</span>}
          </li>
        })}</ul>
      </section>}
    </div>
  )
}

const skeleton = 'mb-3 h-4 w-5/6 animate-pulse rounded'
const activeAndTitles = 'bg-neutral-800 dark:bg-neutral-300'
const items = 'bg-neutral-400 dark:bg-neutral-700'

export function Categories() {
  return (
    <Suspense
      fallback={
        <div className="col-span-2 hidden h-[400px] w-full flex-none py-4 lg:block">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <CategoryList />
    </Suspense>
  )
}
