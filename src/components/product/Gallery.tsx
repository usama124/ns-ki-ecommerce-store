'use client'

import type { Media as MediaType } from '@/payload-types'
import { Media } from '@/components/Media'
import { GridTileImage } from '@/components/Grid/tile'
import React, { useState } from 'react'

type GalleryItem = {
  image: MediaType
}

type Props = {
  gallery: GalleryItem[]
}

export const Gallery: React.FC<Props> = ({ gallery = [] }) => {
  const [current, setCurrent] = useState(0)

  if (!gallery || gallery.length === 0) return null

  const activeItem = gallery[current] || gallery[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100 rounded-sm">
        {activeItem?.image && (
          <Media
            resource={activeItem.image}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover"
          />
        )}
      </div>

      {gallery.length > 1 && (
        <div className="flex space-x-3 overflow-x-auto pb-2">
          {gallery.map((item, i) => {
            if (!item.image) return null

            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`relative w-20 aspect-[3/4] flex-none overflow-hidden rounded-xs border-2 transition-all ${
                  i === current ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <GridTileImage active={i === current} media={item.image} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
