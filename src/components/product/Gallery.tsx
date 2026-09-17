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

  const prev = () => setCurrent((current - 1 + gallery.length) % gallery.length)
  const next = () => setCurrent((current + 1) % gallery.length)

  return (
    <div className="flex flex-col gap-4">
      {/* Main Preview Image */}
      <div className="relative w-full aspect-[3/4] rounded-xl bg-[#03171E] border border-[#648698]/30 shadow-md overflow-hidden">
        {activeUrl ? (
          <Image
            src={activeUrl}
            alt={activeAlt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#648698] text-xs font-serif tracking-[0.2em] uppercase">
            N&apos;s KI
          </div>
        )}

        {gallery.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-[#03171E]/75 backdrop-blur-sm border border-[#648698]/40 text-[#BDBAB9] hover:bg-[#648698]/50 hover:text-white transition-all duration-200 shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-[#03171E]/75 backdrop-blur-sm border border-[#648698]/40 text-[#BDBAB9] hover:bg-[#648698]/50 hover:text-white transition-all duration-200 shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <div className="absolute bottom-3 right-3 bg-[#03171E]/70 backdrop-blur-md text-[#BDBAB9] text-[10px] font-medium tracking-widest px-3 py-1 rounded-full border border-[#648698]/30">
              {current + 1} / {gallery.length}
            </div>
          </>
        )}
      </div>

      {gallery.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
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
                className={`relative w-20 flex-none aspect-[3/4] overflow-hidden rounded-lg border-2 bg-[#03171E] transition-all duration-200 ${
                  isSelected
                    ? 'border-[#648698] shadow-md opacity-100 scale-[0.97]'
                    : 'border-transparent opacity-50 hover:opacity-85 hover:border-[#648698]/50'
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <Image
                  src={thumbUrl}
                  alt={typeof img === 'object' && img.alt ? img.alt : `Thumbnail ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
