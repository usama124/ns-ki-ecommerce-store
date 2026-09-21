'use client'

import type { Media as MediaType } from '@/payload-types'
import { X, ZoomIn } from 'lucide-react'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type GalleryItem = {
  image: MediaType
}

type Props = {
  gallery: GalleryItem[]
}

export const Gallery: React.FC<Props> = ({ gallery = [] }) => {
  const [current, setCurrent] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [lightboxOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) setLightboxOpen(false)
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightboxOpen])

  if (!gallery || gallery.length === 0) return null

  const activeItem = gallery[current] || gallery[0]
  const activeImage = activeItem?.image
  const activeUrl =
    typeof activeImage === 'object' && activeImage?.url ? activeImage.url : undefined
  const activeAlt =
    typeof activeImage === 'object' && activeImage?.alt ? activeImage.alt : "N's KI Luxury Product"

  const prev = () => setCurrent((current - 1 + gallery.length) % gallery.length)
  const next = () => setCurrent((current + 1) % gallery.length)

  const lightboxModal = (
    <div className="fixed inset-0 z-50 bg-[#03171E]/95 backdrop-blur-2xl flex flex-col justify-between items-center p-4 sm:p-8 animate-in fade-in duration-200 text-white">
      <div className="w-full flex justify-between items-center z-10 max-w-7xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#648698]">
          Image {current + 1} of {gallery.length}
        </span>
        <button
          onClick={() => setLightboxOpen(false)}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#648698] hover:text-white rounded-lg transition-colors"
          aria-label="Close Lightbox"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative w-full max-w-5xl aspect-[3/4] max-h-[80vh] flex items-center justify-center my-auto">
        {activeUrl && (
          <Image
            src={activeUrl}
            alt={activeAlt}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        )}
      </div>

      {gallery.length > 1 && (
        <div className="flex items-center gap-4 z-10">
          <button
            type="button"
            onClick={prev}
            className="p-3 min-w-[44px] min-h-[44px] rounded-full bg-[#07242e] border border-[#648698]/40 text-[#CBCCC7] hover:text-white flex items-center justify-center"
            aria-label="Previous image"
          >
            ‹
          </button>
          <span className="text-xs font-mono text-[#648698]">
            {current + 1} / {gallery.length}
          </span>
          <button
            type="button"
            onClick={next}
            className="p-3 min-w-[44px] min-h-[44px] rounded-full bg-[#07242e] border border-[#648698]/40 text-[#CBCCC7] hover:text-white flex items-center justify-center"
            aria-label="Next image"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Lightbox Portal */}
      {mounted && lightboxOpen && createPortal(lightboxModal, document.body)}

      {/* Main Preview Image */}
      <div
        onClick={() => activeUrl && setLightboxOpen(true)}
        className="relative w-full aspect-[3/4] rounded-xl bg-[#03171E] border border-[#648698]/30 shadow-md overflow-hidden cursor-zoom-in group"
      >
        {activeUrl ? (
          <Image
            src={activeUrl}
            alt={activeAlt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain transition-opacity duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#648698] text-xs font-serif tracking-[0.2em] uppercase">
            N&apos;s KI
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setLightboxOpen(true)
          }}
          className="absolute top-3 right-3 p-2.5 min-w-[44px] min-h-[44px] rounded-full bg-[#03171E]/75 backdrop-blur-md border border-[#648698]/40 text-[#BDBAB9] hover:text-white flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
          aria-label="Zoom image"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {gallery.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#03171E]/75 backdrop-blur-sm border border-[#648698]/40 text-[#BDBAB9] hover:bg-[#648698]/50 hover:text-white transition-all duration-200 shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#03171E]/75 backdrop-blur-sm border border-[#648698]/40 text-[#BDBAB9] hover:bg-[#648698]/50 hover:text-white transition-all duration-200 shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
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
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
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
                className={`relative w-20 flex-none aspect-[3/4] overflow-hidden rounded-lg border-2 bg-[#03171E] transition-all duration-200 min-h-[44px] ${
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
