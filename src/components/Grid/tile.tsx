import { Label } from '@/components/Grid/Label'
import { Media } from '@/components/Media'
import type { Media as MediaType } from '@/payload-types'
import clsx from 'clsx'
import Image from 'next/image'
import React from 'react'

type Props = {
  active?: boolean
  isInteractive?: boolean
  label?: {
    amount: number
    position?: 'bottom' | 'center'
    title: string
  }
  media?: MediaType
  src?: string
  alt?: string
  fill?: boolean
  sizes?: string
}

export const GridTileImage: React.FC<Props> = ({
  active,
  isInteractive = true,
  label,
  media,
  src,
  alt = "N's KI Product",
  fill,
  sizes,
  ...props
}) => {
  const imageUrl = src || (media && typeof media === 'object' ? media.url : undefined)

  return (
    <div
      className={clsx(
        'group flex h-full w-full items-center justify-center overflow-hidden rounded-xl border transition-all duration-300 glass-card hover:border-[#648698] hover:shadow-xl',
        {
          'border-2 border-[#648698] ring-2 ring-[#648698]/30': active,
          'border-[#648698]/20': !active,
          relative: label || fill,
        },
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill={fill ?? true}
          sizes={sizes || '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'}
          className={clsx('object-cover', {
            'transition duration-300 ease-in-out group-hover:scale-105': isInteractive,
          })}
        />
      ) : media ? (
        <Media
          className={clsx('relative h-full w-full object-cover', {
            'transition duration-300 ease-in-out group-hover:scale-105': isInteractive,
          })}
          height={80}
          imgClassName="h-full w-full object-cover"
          resource={media}
          width={80}
        />
      ) : null}
      {label ? <Label amount={label.amount} position={label.position} title={label.title} /> : null}
    </div>
  )
}
