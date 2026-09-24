'use client'

import { Clock, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Props = {
  saleSettings: {
    isActive?: boolean
    title?: string
    startDate?: string
    endDate?: string
    discountPercentage?: number
    announcementText?: string
    enablePopup?: boolean
  } | null
}

export function SalePopupBanner({ saleSettings }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  const isLive = Boolean(
    saleSettings?.isActive &&
      saleSettings?.enablePopup !== false &&
      saleSettings?.announcementText &&
      (!saleSettings.startDate || new Date(saleSettings.startDate).getTime() <= Date.now()) &&
      (!saleSettings.endDate || new Date(saleSettings.endDate).getTime() >= Date.now()),
  )

  useEffect(() => {
    if (!saleSettings?.endDate || !isLive) return

    const interval = setInterval(() => {
      const now = Date.now()
      const end = new Date(saleSettings.endDate!).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft('')
        clearInterval(interval)
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const secs = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
            .toString()
            .padStart(2, '0')}`,
        )
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [saleSettings?.endDate, isLive])

  if (!isLive || dismissed) return null

  return (
    <div className="relative z-50 bg-gradient-to-r from-[#800020] via-[#500014] to-[#03171E] text-white px-4 py-2.5 shadow-lg border-b border-[#B8860B]/30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          <Sparkles className="h-4 w-4 text-[#B8860B] shrink-0 animate-pulse" />
          <p className="truncate font-semibold tracking-wide">
            {saleSettings?.announcementText}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {timeLeft && (
            <div className="hidden sm:flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full text-xs font-mono border border-[#B8860B]/40 text-[#FFD700]">
              <Clock className="h-3.5 w-3.5" />
              <span>{timeLeft}</span>
            </div>
          )}

          <Link
            href="/sale"
            className="bg-[#B8860B] hover:bg-[#D4AF37] text-black font-extrabold px-3 py-1 rounded-md text-xs uppercase tracking-wider transition-colors shadow-sm"
          >
            Shop Sale
          </Link>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss sale alert"
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

