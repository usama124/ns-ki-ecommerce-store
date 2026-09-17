import clsx from 'clsx'
import React from 'react'

import { Price } from '@/components/Price'

type Props = {
  amount: number
  position?: 'bottom' | 'center'
  title: string
}

export const Label: React.FC<Props> = ({ amount, position = 'bottom', title }) => {
  return (
    <div
      className={clsx('absolute bottom-0 left-0 flex w-full px-4 pb-4 @container/label', {
        '': position === 'center',
      })}
    >
      <div className="flex items-end justify-between text-sm grow font-semibold gap-2">
        <h3 className="font-mono line-clamp-2 border border-[#648698]/40 p-2.5 px-3.5 leading-none tracking-tight rounded-full bg-[#03171E]/80 text-[#CBCCC7] backdrop-blur-md shadow-lg">
          {title}
        </h3>

        <Price
          amount={amount}
          className="flex-none rounded-full bg-[#648698] p-2.5 px-3.5 text-white font-bold border border-white/20 shadow-lg backdrop-blur-md"
        />
      </div>
    </div>
  )
}
