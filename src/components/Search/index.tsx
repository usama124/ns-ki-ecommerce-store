'use client'

import { cn } from '@/utilities/cn'
import { createUrl } from '@/utilities/createUrl'
import { SearchIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

type Props = {
  className?: string
}

export const Search: React.FC<Props> = ({ className }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const val = e.target as HTMLFormElement
    const search = val.search as HTMLInputElement
    const newParams = new URLSearchParams(searchParams.toString())

    if (search.value) {
      newParams.set('q', search.value)
    } else {
      newParams.delete('q')
    }

    router.push(createUrl('/shop', newParams))
  }

  return (
    <form className={cn('relative w-full', className)} onSubmit={onSubmit}>
      <input
        autoComplete="off"
        className="w-full rounded-xl border border-[#648698]/30 bg-white/80 dark:bg-[#03171E]/80 px-4 py-2.5 text-sm text-[#03171E] dark:text-[#f0f3f4] placeholder:text-[#648698] backdrop-blur-md focus:border-[#648698] focus:ring-2 focus:ring-[#648698]/30 outline-hidden transition-all shadow-sm"
        defaultValue={searchParams?.get('q') || ''}
        key={searchParams?.get('q')}
        name="search"
        placeholder="Search for products..."
        type="text"
      />
      <div className="absolute right-0 top-0 mr-3 flex h-full items-center text-[#648698]">
        <SearchIcon className="h-4 w-4" />
      </div>
    </form>
  )
}
