'use client'

import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

type Connection = EventTarget & { saveData?: boolean }
const connection = () => (navigator as Navigator & { connection?: Connection }).connection
function subscribePreferences(notify: () => void) {
  const queries = [window.matchMedia('(prefers-reduced-motion: reduce)'), window.matchMedia('(max-width: 767px)')]
  queries.forEach(query => query.addEventListener('change', notify))
  connection()?.addEventListener('change', notify)
  return () => {
    queries.forEach(query => query.removeEventListener('change', notify))
    connection()?.removeEventListener('change', notify)
  }
}
const preferences = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0)
  | (window.matchMedia('(max-width: 767px)').matches ? 2 : 0) | (connection()?.saveData ? 4 : 0) | 8

export function FloatingProductVideo({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const flags = useSyncExternalStore(subscribePreferences, preferences, () => 0)
  const [closed, setClosed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [manual, setManual] = useState(false)
  const [obscured, setObscured] = useState(false)
  const [inlineVisible, setInlineVisible] = useState(false)
  const [inlinePlaying, setInlinePlaying] = useState(false)
  const [purchaseVisible, setPurchaseVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const player = useRef<HTMLVideoElement>(null)
  const small = Boolean(flags & 2)
  const blocked = obscured || inlineVisible || inlinePlaying || (small && purchaseVisible)
  const shouldPlay = Boolean(flags & 8) && !closed && !failed && !blocked && !paused && (manual || !(flags & 5))

  useEffect(() => {
    if (closed || failed) return
    const update = () => setObscured(document.hidden || document.body.style.overflow === 'hidden' || Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')))
    update()
    document.addEventListener('visibilitychange', update)
    const mutation = new MutationObserver(update)
    mutation.observe(document.body, { attributes: true, attributeFilter: ['style'], childList: true })
    const inline = document.querySelector<HTMLVideoElement>('[data-product-reel-inline] video')
    const onInlinePlay = () => setInlinePlaying(true)
    const onInlinePause = () => setInlinePlaying(false)
    inline?.addEventListener('play', onInlinePlay)
    inline?.addEventListener('pause', onInlinePause)
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target.hasAttribute('data-product-reel-inline')) setInlineVisible(entry.isIntersecting)
        else setPurchaseVisible(entry.isIntersecting)
      }
    }, { rootMargin: '24px', threshold: 0 }) : null
    const anchor = document.querySelector('[data-product-reel-inline]')
    const purchase = document.querySelector('[data-product-purchase]')
    if (anchor) observer?.observe(anchor)
    if (purchase) observer?.observe(purchase)
    return () => {
      mutation.disconnect()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      inline?.removeEventListener('play', onInlinePlay)
      inline?.removeEventListener('pause', onInlinePause)
    }
  }, [closed, failed])

  useEffect(() => {
    const video = player.current
    if (!video) return
    let cancelled = false
    if (shouldPlay) {
      void video.play()?.catch(() => { if (!cancelled) setPaused(true) })
    } else video.pause()
    return () => { cancelled = true; video.pause() }
  }, [shouldPlay])

  if (!(flags & 8) || closed || failed) return null
  return createPortal(<aside aria-label={`${title} product reel`} hidden={blocked}
    className="fixed z-30 left-3 sm:left-5 overflow-hidden rounded-xl border border-white/25 shadow-2xl bg-[#03171E] text-white"
    style={{ bottom: small ? 'calc(88px + env(safe-area-inset-bottom, 0px))' : '20px', width: expanded ? 'min(300px, calc(100vw - 24px), 38svh)' : small ? '132px' : '160px' }}>
    <div className="relative aspect-[9/16]">
      <video ref={player} src={src} poster={poster} muted={muted} loop playsInline
        preload={flags & 5 && !manual ? 'none' : 'metadata'} aria-label={`${title} reel video`}
        className="w-full h-full object-cover" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} />
      <button type="button" aria-label="Close product reel" onClick={() => setClosed(true)}
        className="absolute top-0 right-0 w-11 h-11 grid place-items-center rounded-bl-lg bg-black/65"><X className="w-4 h-4" /></button>
      {!playing && <button type="button" aria-label="Play product reel" onClick={() => { setManual(true); setPaused(false) }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-black/65"><Play className="w-5 h-5" /></button>}
      <div className="absolute bottom-0 inset-x-0 flex justify-between bg-black/70">
        <button type="button" aria-label={playing ? 'Pause product reel' : 'Play product reel'} onClick={() => { setManual(true); setPaused(playing) }}
          className="min-w-11 min-h-11 flex-1 grid place-items-center">{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
        <button type="button" aria-label={muted ? 'Unmute product reel' : 'Mute product reel'} onClick={() => setMuted(value => !value)}
          className="min-w-11 min-h-11 flex-1 grid place-items-center">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
        <button type="button" aria-expanded={expanded} aria-label={expanded ? 'Minimize product reel' : 'Expand product reel'} onClick={() => setExpanded(value => !value)}
          className="min-w-11 min-h-11 flex-1 grid place-items-center">{expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
      </div>
    </div>
  </aside>, document.body)
}
