'use client'
import { formatPKR } from '@/utilities/formatPKR'
import React from 'react'

type BaseProps = {
  className?: string
  as?: 'span' | 'p'
}

type PriceFixed = {
  amount: number
  highestAmount?: never
  lowestAmount?: never
}

type PriceRange = {
  amount?: never
  highestAmount: number
  lowestAmount: number
}

type Props = BaseProps & (PriceFixed | PriceRange)

export const Price = ({
  amount,
  className,
  highestAmount,
  lowestAmount,
  as = 'p',
}: Props & React.ComponentProps<'p'>) => {
  const Element = as

  if (typeof amount === 'number') {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatPKR(amount)}
      </Element>
    )
  }

  if (highestAmount !== undefined && lowestAmount !== undefined && highestAmount !== lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {`${formatPKR(lowestAmount)} - ${formatPKR(highestAmount)}`}
      </Element>
    )
  }

  if (lowestAmount !== undefined) {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatPKR(lowestAmount)}
      </Element>
    )
  }

  return null
}
