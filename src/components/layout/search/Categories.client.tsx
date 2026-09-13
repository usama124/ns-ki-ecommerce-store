'use client'
import React, { useCallback, useMemo } from 'react'

import { Category } from '@/payload-types'
import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  category: Category
}

export const CategoryItem: React.FC<Props> = ({ category }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = useMemo(() => {
    const paramCat = searchParams.get('category')
    return (
      pathname === `/shop/${category.slug}` ||
      paramCat === String(category.id) ||
      paramCat === category.slug
    )
  }, [category.id, category.slug, pathname, searchParams])

  const setQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('category')
    const queryString = params.toString() ? `?${params.toString()}` : ''

    if (isActive) {
      router.push(`/shop${queryString}`)
    } else {
      router.push(`/shop/${category.slug}${queryString}`)
    }
  }, [category.id, category.slug, isActive, router, searchParams])

  return (
    <button
      onClick={() => setQuery()}
      className={clsx(
        'hover:cursor-pointer block text-xs uppercase tracking-wider py-1 transition-colors',
        {
          'font-bold text-amber-800 underline underline-offset-4': isActive,
          'text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white':
            !isActive,
        },
      )}
    >
      {category.name}
    </button>
  )
}
