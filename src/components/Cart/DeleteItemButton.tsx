'use client'

import { useCart } from '@/providers/Cart'
import clsx from 'clsx'
import { XIcon } from 'lucide-react'
import React from 'react'

export function DeleteItemButton({ productId, variantSize }: { productId: string; variantSize: string }) {
  const { removeItem } = useCart()

  return (
    <button
      aria-label="Remove cart item"
      className={clsx(
        'ease hover:cursor-pointer flex h-[17px] w-[17px] items-center justify-center rounded-full bg-neutral-500 transition-all duration-200'
      )}
      onClick={(e: React.FormEvent<HTMLButtonElement>) => {
        e.preventDefault()
        removeItem(productId, variantSize)
      }}
      type="button"
    >
      <XIcon className="hover:text-accent-3 mx-px h-4 w-4 text-white dark:text-black" />
    </button>
  )
}
