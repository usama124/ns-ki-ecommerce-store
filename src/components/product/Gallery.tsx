'use client'

import type { Media as MediaType } from '@/payload-types'
import Image from 'next/image'
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
  const activeImage = activeItem?.image
  const activeUrl =
    typeof activeImage === 'object' && activeImage?.url ? activeImage.url : undefined
  const activeAlt =
    typeof activeImage === 'object' && activeImage?.alt ? activeImage.alt : "N's KI Luxury Product"

  return (
    <div className="flex flex-col gap-4">
      {/* Big Main Preview Image */}
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-lg bg-stone-100 border border-stone-200/60 shadow-sm group">
        {activeUrl ? (
          <Image
            src={activeUrl}
            alt={activeAlt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-serif tracking-[0.2em] uppercase">
            N's KI
          </div>
        )}

        {/* Image index pill */}
        {gallery.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium tracking-widest px-3 py-1 rounded-full border border-white/20">
            {current + 1} / {gallery.length}
          </div>
        )}
      </div>

      {/* Thumbnails list */}
      {gallery.length > 1 && (
        <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {gallery.map((item, i) => {
            const img = item.image
            const thumbUrl = typeof img === 'object' && img?.url ? img.url : undefined
            if (!thumbUrl) return null
            const isSelected = i === current

            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`relative w-20 aspect-[3/4] flex-none overflow-hidden rounded-md border-2 transition-all ${
                  isSelected
                    ? 'border-amber-700 shadow-md scale-95 opacity-100'
                    : 'border-transparent opacity-60 hover:opacity-100 hover:border-stone-300'
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <Image
                  src={thumbUrl}
                  alt={typeof img === 'object' && img.alt ? img.alt : `Thumbnail ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
