'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ResponsiveImage } from '@/components/Media/ResponsiveImage'
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
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => setIsMobile(viewport.matches)
    updateViewport()
    viewport.addEventListener('change', updateViewport)
    return () => viewport.removeEventListener('change', updateViewport)
  }, [])

  if (isMobile === null) {
    const hasDesktop = slides.some((slide) => getMediaUrl(slide.desktopMedia))
    const hasMobile = hasDesktop || slides.some((slide) => getMediaUrl(slide.mobileMedia))
    if (!hasMobile) return null
    // Reserve the final height during hydration so the catalog does not jump
    // downwards when a mobile-only hero appears.
    return <div aria-hidden="true" className={`h-[55vh] sm:h-[70vh] lg:h-[75vh] max-h-[850px] bg-black ${hasDesktop ? '' : 'md:hidden'}`} />
  }

  const visibleSlides = slides.flatMap((slide) => {
    const desktopUrl = getMediaUrl(slide.desktopMedia)
    const mobileUrl = getMediaUrl(slide.mobileMedia)
    const media = isMobile && mobileUrl ? slide.mobileMedia : slide.desktopMedia
    if (!(isMobile ? mobileUrl || desktopUrl : desktopUrl)) return []
    return [{ ...slide, desktopMedia: media }]
  })

  if (visibleSlides.length === 0) return null

  return <HeroCarousel key={isMobile ? 'mobile' : 'desktop'} slides={visibleSlides} />
}

function getMediaUrl(media: any): string | undefined {
  const url = typeof media === 'object' && media !== null ? media.url : media
  // An unpopulated relationship ID is not a media URL.
  return typeof url === 'string' && /^(https?:\/\/|\/)/.test(url) ? url : undefined
}

function HeroCarousel({ slides }: Props) {
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
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  return (
    <div className="relative overflow-hidden w-full bg-black group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => {
            const desktopUrl = getMediaUrl(slide.desktopMedia)
            const mimeType = slide.desktopMedia?.mimeType

            const isVideo =
              typeof mimeType === 'string'
                ? mimeType.startsWith('video/')
                : /\.(mp4|webm|ogv|mov)(?:[?#]|$)/i.test(desktopUrl || '') ||
                  slide.mediaType === 'video'

            return (
              <div
                key={index}
                className="relative flex-[0_0_100%] min-w-0 aspect-[4/5] sm:aspect-[16/9] lg:aspect-[16/6] h-[55vh] sm:h-[70vh] lg:h-[75vh] max-h-[850px] overflow-hidden"
              >
                {/* Media rendering */}
                {isVideo ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={slide.heading || "N's KI Banner Video"}
                    className="absolute inset-0 w-full h-full object-cover"
                    src={desktopUrl}
                  />
                ) : (
                  <div className="relative w-full h-full">
                    {desktopUrl && (
                      <ResponsiveImage
                        media={slide.desktopMedia}
                        variant="hero"
                        alt={slide.heading || "N's KI Banner"}
                        fill
                        priority={index === 0}
                        className="object-cover"
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
