'use client'

import type { SortFilterItem as SortFilterItemType } from '@/lib/constants'

import { createUrl } from '@/utilities/createUrl'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import type { ListItem, PathFilterItem as PathFilterItemType } from '.'

function PathFilterItem({ item }: { item: PathFilterItemType }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = pathname === item.path
  const newParams = new URLSearchParams(searchParams.toString())
  const DynamicTag = active ? 'p' : Link

  newParams.delete('q')

  return (
    <li className="mt-1 flex" key={item.title}>
      <DynamicTag
        className={clsx(
          'w-full text-xs uppercase tracking-wider py-1.5 px-3 rounded-lg transition-all font-medium',
          {
            'font-bold text-foreground bg-[#648698]/25 border border-[#648698]/40 shadow-xs':
              active,
            'text-muted-foreground hover:text-foreground hover:bg-[#648698]/10': !active,
          },
        )}
        href={createUrl(item.path, newParams)}
      >
        {item.title}
      </DynamicTag>
    </li>
  )
}

function SortFilterItem({ item }: { item: SortFilterItemType }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get('sort') === item.slug
  const q = searchParams.get('q')
  const href = createUrl(
    pathname,
    new URLSearchParams({
      ...(q && { q }),
      ...(item.slug && item.slug.length && { sort: item.slug }),
    }),
  )
  const DynamicTag = active ? 'p' : Link

  return (
    <li className="mt-1 flex" key={item.title}>
      <DynamicTag
        className={clsx(
          'w-full text-xs uppercase tracking-wider py-1.5 px-3 rounded-lg transition-all font-medium',
          {
            'font-bold text-foreground bg-[#648698]/25 border border-[#648698]/40 shadow-xs':
              active,
            'text-muted-foreground hover:text-foreground hover:bg-[#648698]/10': !active,
          },
        )}
        href={href}
        prefetch={!active ? false : undefined}
      >
        {item.title}
      </DynamicTag>
    </li>
  )
}

export function FilterItem({ item }: { item: ListItem }) {
  return 'path' in item ? <PathFilterItem item={item} /> : <SortFilterItem item={item} />
}
