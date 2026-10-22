'use client'

import { useRef, type PointerEvent } from 'react'
import { moveImageCrop, resizeImageCrop, scaleImageCrop, type ImageCrop } from '@/utilities/adminImageOptimizer'

export function CropSelection({ url, width, height, crop, disabled, onChange }: {
  url: string
  width: number
  height: number
  crop: ImageCrop
  disabled: boolean
  onChange: (crop: ImageCrop) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; width: number; height: number; crop: ImageCrop; corner?: string } | null>(null)
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || !frame.current) return
    const bounds = frame.current.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    event.preventDefault()
    const corner = (event.target as HTMLElement).closest<HTMLElement>('[data-corner]')?.dataset.corner
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height, crop: { ...crop }, corner }
    frame.current.setPointerCapture(event.pointerId)
  }
  const end = () => { drag.current = null }

  return <div ref={frame} className="admin-image-optimizer__original" style={{ width: Math.min(700, 560 * width / height) }}
    onPointerMove={event => {
      const start = drag.current
      if (disabled || !start || start.id !== event.pointerId) return
      const dx = (event.clientX - start.x) / start.width * 100
      const dy = (event.clientY - start.y) / start.height * 100
      onChange(start.corner ? resizeImageCrop(start.crop, dx, dy, start.corner) : moveImageCrop(start.crop, dx, dy))
    }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt="Original image; move and resize the crop around the product" draggable={false} />
    <div role="group" aria-label="Selected crop area" aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
      className="admin-image-optimizer__crop" onPointerDown={start}
      style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
      onKeyDown={event => {
        if (disabled || event.target !== event.currentTarget) return
        const step = event.shiftKey ? 5 : 1
        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
        if (moves[event.key]) { event.preventDefault(); onChange(moveImageCrop(crop, ...moves[event.key])) }
        if (['+', '=', '-'].includes(event.key)) {
          event.preventDefault()
          onChange(scaleImageCrop(crop, event.key === '-' ? 0.95 : 1.05))
        }
      }}>
      {['nw', 'ne', 'sw', 'se'].map(corner => <button key={corner} type="button" disabled={disabled}
        className={`admin-image-optimizer__handle admin-image-optimizer__handle--${corner}`} data-corner={corner}
        aria-label={`Resize crop ${corner}`} title="Drag to resize the crop while keeping its shape"
        onKeyDown={event => {
          if (event.key === '-' || event.key === '+') {
            event.preventDefault()
            onChange(scaleImageCrop(crop, event.key === '-' ? 0.95 : 1.05))
          }
        }} />)}
    </div>
  </div>
}
