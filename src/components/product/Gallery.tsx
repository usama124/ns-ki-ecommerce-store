'use client'

import type { Media as MediaType } from '@/payload-types'
import { X, ZoomIn } from 'lucide-react'
import { ResponsiveImage } from '@/components/Media/ResponsiveImage'
import { ZoomableImage } from './ZoomableImage'
import { responsiveMedia } from '@/utilities/responsiveMedia'
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

type GalleryItem = {
  image: MediaType
}

type Props = {
  gallery: GalleryItem[]
}
const subscribe = () => () => {}

export const Gallery: React.FC<Props> = ({ gallery = [] }) => {
  const [current, setCurrent] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const zoomButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const prev = useCallback(() => setCurrent(value => (value - 1 + gallery.length) % (gallery.length || 1)), [gallery.length])
  const next = useCallback(() => setCurrent(value => (value + 1) % (gallery.length || 1)), [gallery.length])

  useEffect(() => {
    if (!lightboxOpen) return
    const previous = document.body.style.overflow
    const trigger = zoomButton.current
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    return () => {
      document.body.style.overflow = previous
      trigger?.focus()
    }
  }, [lightboxOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) setLightboxOpen(false)
      if (lightboxOpen && e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      if (lightboxOpen && e.key === 'ArrowRight') { e.preventDefault(); next() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightboxOpen, next, prev])

  if (!gallery || gallery.length === 0) return null

  const activeItem = gallery[current] || gallery[0]
  const activeImage = activeItem?.image
  const activeUrl = responsiveMedia(activeImage, 'original').src
  const activeAlt =
    typeof activeImage === 'object' && activeImage?.alt ? activeImage.alt : "N's KI Luxury Product"

  const lightboxModal = (
    <div role="dialog" aria-modal="true" aria-label="Product image zoom" className="fixed inset-0 z-50 bg-[#03171E]/95 backdrop-blur-2xl flex flex-col justify-between items-center p-4 sm:p-8 animate-in fade-in duration-200 text-white"
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <div className="w-full flex justify-between items-center z-10 max-w-7xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#648698]">
          Image {current + 1} of {gallery.length}
        </span>
        <button
          ref={closeButton}
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#648698] hover:text-white rounded-lg transition-colors"
          aria-label="Close Lightbox"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <p className="text-xs text-center text-white/80">Click or tap the image to zoom in/out. Move your pointer or drag your finger to inspect details.</p>
      <div className="relative w-full max-w-5xl flex-1 min-h-0 my-4 overflow-hidden">
        {activeUrl && (
          <ZoomableImage key={activeUrl} media={activeImage} alt={activeAlt} lightbox />
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
    <div className="mx-auto flex w-[min(100%,440px,38svh)] sm:w-[min(100%,440px,48svh)] flex-col gap-2 sm:gap-4">
      {/* Lightbox Portal */}
      {mounted && lightboxOpen && createPortal(lightboxModal, document.body)}

      {/* Main Preview Image */}
      <div
        onClick={() => activeUrl && setLightboxOpen(true)}
        className="relative w-full aspect-[2/3] rounded-xl bg-[#03171E] border border-[#648698]/30 shadow-md overflow-hidden cursor-zoom-in group"
      >
        {activeUrl ? (
          <ZoomableImage key={activeUrl} media={activeImage} alt={activeAlt} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#648698] text-xs font-serif tracking-[0.2em] uppercase">
            N&apos;s KI
          </div>
        )}

        <button
          ref={zoomButton}
          type="button"
          disabled={!activeUrl}
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

      <p className="text-center text-xs text-[#648698]">Hover to zoom · Tap or click to expand</p>

      {gallery.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {gallery.map((item, i) => {
            const img = item.image
            const thumbUrl = responsiveMedia(img, 'thumbnail').src
            if (!thumbUrl) return null
            const isSelected = i === current

            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`relative w-16 sm:w-20 flex-none aspect-[3/4] overflow-hidden rounded-lg border-2 bg-[#03171E] transition-all duration-200 min-h-[44px] ${
                  isSelected
                    ? 'border-[#648698] shadow-md opacity-100 scale-[0.97]'
                    : 'border-transparent opacity-50 hover:opacity-85 hover:border-[#648698]/50'
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <ResponsiveImage
                  media={img}
                  variant="thumbnail"
                  alt={typeof img === 'object' && img.alt ? img.alt : `Thumbnail ${i + 1}`}
                  fill
                  sizes="(min-width: 640px) 80px, 64px"
                  className="object-cover object-center"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
