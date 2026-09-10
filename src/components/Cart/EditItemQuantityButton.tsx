'use client'

import { useCart } from '@/providers/Cart'
import clsx from 'clsx'
import { MinusIcon, PlusIcon } from 'lucide-react'
import React from 'react'

export function EditItemQuantityButton({
  productId,
  variantSize,
  variantColor,
  quantity,
  type,
}: {
  productId: string
  variantSize: string
  variantColor?: string
  quantity: number
  type: 'minus' | 'plus'
}) {
  const { updateQuantity } = useCart()

  return (
    <button
      aria-label={type === 'plus' ? 'Increase item quantity' : 'Reduce item quantity'}
      className={clsx(
        'ease flex h-full min-w-[36px] max-w-[36px] items-center justify-center rounded-full p-2 transition-all duration-200 hover:border-neutral-800 hover:opacity-80',
        {
          'ml-auto': type === 'minus',
        },
      )}
      onClick={(e: React.FormEvent<HTMLButtonElement>) => {
        e.preventDefault()
        const newQty = type === 'plus' ? quantity + 1 : quantity - 1
        updateQuantity(productId, variantSize, variantColor, newQty)
      }}
      type="button"
    >
      {type === 'plus' ? (
        <PlusIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
      ) : (
        <MinusIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
      )}
    </button>
  )
}
