'use client'

import { ResponsiveImage } from '@/components/Media/ResponsiveImage'
import { responsiveMedia } from '@/utilities/responsiveMedia'
import { useRef, useState, type PointerEvent } from 'react'

/** Shared inline magnifier. Full-resolution bytes are fetched only on interaction. */
export function ZoomableImage({ media, alt, lightbox = false }: { media: unknown; alt: string; lightbox?: boolean }) {
  const [hovering, setHovering] = useState(false)
  const [toggled, setToggled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const surface = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; dragged: boolean } | null>(null)
  const source = responsiveMedia(media, 'original').src
  const zoomed = !failed && (lightbox ? toggled : hovering)
  const position = (event: PointerEvent<HTMLElement>) => {
    if (!surface.current) return
    const rect = surface.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100))
    const y = Math.min(100, Math.max(0, (event.clientY - rect.top) / rect.height * 100))
    surface.current.style.setProperty('--zoom-x', `${x}%`)
    surface.current.style.setProperty('--zoom-y', `${y}%`)
  }
  const fit = lightbox ? 'object-contain' : 'object-cover'
  const image = <>
    <ResponsiveImage media={media} alt={alt} fill priority variant={lightbox ? 'original' : 'card'}
      sizes={lightbox ? '100vw' : 'min(100vw, 440px, 48svh)'} className={`${fit} object-center`} />
    {zoomed && source && <div data-testid="image-magnifier" aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ transform: 'scale(2.5)', transformOrigin: 'var(--zoom-x, 50%) var(--zoom-y, 50%)', opacity: loaded ? 1 : 0 }}>
      {/* Original source is intentional: detail zoom must not magnify a small card thumbnail. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt="" draggable={false} decoding="async" onLoad={() => setLoaded(true)}
        onError={() => { setFailed(true); setHovering(false); setToggled(false) }}
        className={`absolute inset-0 w-full h-full ${fit} object-center`} />
    </div>}
  </>
  return <div ref={surface} className="absolute inset-0 overflow-hidden" data-testid="zoom-surface"
    onPointerEnter={event => { if (!lightbox && event.pointerType === 'mouse') { position(event); setHovering(true) } }}
    onPointerMove={event => { if (zoomed) position(event) }}
    onPointerLeave={() => { setHovering(false) }}>
    {lightbox ? <button type="button" className={`absolute inset-0 w-full h-full ${toggled ? 'cursor-zoom-out touch-none' : 'cursor-zoom-in'}`}
      aria-label={toggled ? 'Zoom out product image' : 'Zoom in product image'} aria-pressed={toggled}
      disabled={!source || failed}
      onPointerDown={event => {
        gesture.current = { x: event.clientX, y: event.clientY, dragged: false }
        if (toggled && event.pointerType === 'touch') event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (gesture.current && event.pointerType === 'touch' && toggled
          && Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 5) gesture.current.dragged = true
      }}
      onPointerCancel={() => { gesture.current = null }}
      onClick={() => {
        if (gesture.current?.dragged) { gesture.current = null; return }
        setToggled(value => !value)
      }}>{image}</button> : image}
    {failed && <span role="status" className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-1">High-resolution zoom unavailable</span>}
  </div>
}
