'use client'
import React, { useCallback, useMemo } from 'react'

import { Category } from '@/payload-types'
import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  category: Pick<Category, 'id' | 'name' | 'slug'>
}

export const CategoryItem: React.FC<Props> = ({ category }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = useMemo(() => {
    const paramCat = searchParams.get('category')
    if (paramCat) return paramCat === String(category.id) || paramCat === category.slug
    return (
      pathname === `/shop/${category.slug}` ||
      paramCat === String(category.id) ||
      paramCat === category.slug
    )
  }, [category.id, category.slug, pathname, searchParams])

  const setQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('category')
    params.delete('page')
    const queryString = params.toString() ? `?${params.toString()}` : ''

    if (isActive) {
      router.push(`/shop${queryString}`)
    } else {
      router.push(`/shop/${category.slug}${queryString}`)
    }
  }, [category.slug, isActive, router, searchParams])

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => setQuery()}
      className={clsx(
        'hover:cursor-pointer block text-xs uppercase tracking-wider py-1.5 px-3 rounded-lg transition-all w-full text-left font-medium',
        {
          'font-bold text-foreground bg-[#648698]/25 border border-[#648698]/40 shadow-xs':
            isActive,
          'text-muted-foreground hover:text-foreground hover:bg-[#648698]/10': !isActive,
        },
      )}
    >
      {category.name}
    </button>
  )
}
