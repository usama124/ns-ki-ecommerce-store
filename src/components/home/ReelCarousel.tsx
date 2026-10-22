'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function ReelCarousel({ count, children }: { count: number; children?: ReactNode }) {
  const id = useId()
  const track = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ start: 1, end: count, previous: false, next: false, overflow: false })
  useEffect(() => {
    const element = track.current
    if (!element) return
    const measure = () => {
      const left = element.scrollLeft
      const right = left + element.clientWidth
      const visible = [...element.children].map((child, index) => {
        const item = child as HTMLElement
        return item.offsetLeft + item.offsetWidth > left + 2 && item.offsetLeft < right - 2 ? index + 1 : 0
      }).filter(Boolean)
      const next = {
        start: visible[0] || 1, end: visible.at(-1) || count,
        previous: left > 2, next: right < element.scrollWidth - 2,
        overflow: element.scrollWidth > element.clientWidth + 2,
      }
      setPosition(current => Object.keys(next).every(key => current[key as keyof typeof current] === next[key as keyof typeof next]) ? current : next)
    }
    measure()
    element.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(element)
    if (element.firstElementChild) observer?.observe(element.firstElementChild)
    return () => { element.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); observer?.disconnect() }
  }, [count])

  const scroll = (direction: number) => {
    const element = track.current
    if (!element) return
    element.scrollBy({ left: direction * element.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return <div>
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="text-xs text-muted-foreground">
        <p>{position.overflow ? 'Swipe, scroll or use the arrows to see more' : `${count} ${count === 1 ? 'reel' : 'reels'} to explore`}</p>
        <p className="mt-1" role="status" aria-live="polite" aria-atomic="true">Reels {position.start}–{position.end} of {count}</p>
      </div>
      {count > 1 && <div className="flex gap-2 shrink-0">
        <button type="button" aria-label="Previous reels" aria-controls={id} disabled={!position.previous} onClick={() => scroll(-1)}
          className="w-11 h-11 grid place-items-center rounded-full border border-[#648698]/50 text-foreground hover:bg-[#648698]/20 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
        <button type="button" aria-label="Next reels" aria-controls={id} disabled={!position.next} onClick={() => scroll(1)}
          className="w-11 h-11 grid place-items-center rounded-full border border-[#648698]/50 text-foreground hover:bg-[#648698]/20 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
      </div>}
    </div>
    <div className="relative">
      <div id={id} ref={track} role="region" aria-roledescription="carousel" aria-label="Shop by Video reels" tabIndex={0}
        className="relative flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory focus-visible:outline-2 focus-visible:outline-[#648698]"
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); scroll(event.key === 'ArrowRight' ? 1 : -1) }
        }}>{children}</div>
      {position.next && <span aria-hidden="true" className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#03171E]/70 to-transparent pointer-events-none" />}
    </div>
  </div>
}
