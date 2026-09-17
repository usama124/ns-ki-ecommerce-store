'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type Slide = {
  id?: string
  mediaType: 'image' | 'video'
  desktopMedia?: any
  mobileMedia?: any
  heading?: string
  subheading?: string
  ctaLabel?: string
  ctaLink?: string
}

type Props = {
  slides: Slide[]
}

export function HeroSlider({ slides = [] }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
  }, [emblaApi, onSelect])

  if (!slides || slides.length === 0) {
    return (
      <div className="relative h-[70vh] min-h-[500px] w-full bg-neutral-900 flex items-center justify-center text-white">
        <div className="text-center px-4">
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-[0.2em] uppercase mb-4">
            N's KI
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] font-light mb-8">
            Pakistani Luxury Fashion
          </p>
          <Link
            href="/shop"
            className="inline-block border border-white px-8 py-3 text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
          >
            Explore Collection
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden w-full bg-black group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => {
            const desktopUrl =
              typeof slide.desktopMedia === 'object' ? slide.desktopMedia?.url : slide.desktopMedia
            const mobileUrl =
              typeof slide.mobileMedia === 'object'
                ? slide.mobileMedia?.url
                : slide.mobileMedia || desktopUrl

            const isVideo =
              slide.mediaType === 'video' ||
              (typeof slide.desktopMedia === 'object' &&
                slide.desktopMedia?.mimeType?.includes('video')) ||
              (typeof desktopUrl === 'string' && /\.(mp4|webm|ogv|mov)$/i.test(desktopUrl))

            return (
              <div
                key={index}
                className="relative flex-[0_0_100%] min-w-0 h-[75vh] min-h-[550px] max-h-[850px] overflow-hidden"
              >
                {/* Media rendering */}
                {isVideo ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                    src={desktopUrl}
                  />
                ) : (
                  <div className="relative w-full h-full">
                    {/* Mobile image */}
                    {mobileUrl && (
                      <Image
                        src={mobileUrl}
                        alt={slide.heading || "N's KI Banner"}
                        fill
                        priority={index === 0}
                        className="object-cover md:hidden"
                        sizes="100vw"
                      />
                    )}
                    {/* Desktop image */}
                    {desktopUrl && (
                      <Image
                        src={desktopUrl}
                        alt={slide.heading || "N's KI Banner"}
                        fill
                        priority={index === 0}
                        className="object-cover hidden md:block"
                        sizes="100vw"
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      {slides.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#03171E]/60 backdrop-blur-md border border-[#648698]/30 hover:bg-[#648698] text-[#CBCCC7] hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#03171E]/60 backdrop-blur-md border border-[#648698]/30 hover:bg-[#648698] text-[#CBCCC7] hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi && emblaApi.scrollTo(i)}
                className={`h-1.5 transition-all duration-300 rounded-full ${
                  selectedIndex === i ? 'w-8 bg-[#648698]' : 'w-2 bg-[#CBCCC7]/50'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
