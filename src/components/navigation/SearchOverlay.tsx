'use client'

import { Search, X, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const QUICK_CHIPS = ['Unstitched', 'Pret', 'Luxury Lawn', 'Formals', 'Chiffon', 'Sale']

export function SearchOverlay({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ''
      setQuery('')
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    onClose()
    router.push(`/shop?q=${encodeURIComponent(query.trim())}`)
  }

  const handleChipClick = (chip: string) => {
    onClose()
    router.push(`/shop?q=${encodeURIComponent(chip)}`)
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[#03171E]/95 backdrop-blur-2xl flex flex-col text-[#CBCCC7] animate-in fade-in duration-200">
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-[#648698]/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#648698]" />
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#648698]">
            Search Collection
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#648698] hover:text-white rounded-lg transition-colors"
          aria-label="Close search"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Main Search Input Form */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col justify-start">
        <form onSubmit={handleSearchSubmit} className="relative mb-8">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-6 w-6 text-[#648698] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search luxury unstitched, pret, lawn..."
              className="w-full pl-13 pr-14 py-4 text-base sm:text-lg font-medium bg-[#07242e]/80 border-2 border-[#648698]/40 rounded-xl text-white placeholder:text-[#648698] focus:outline-none focus:border-[#648698] shadow-xl"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-4 p-2 text-[#648698] hover:text-white"
                aria-label="Clear input"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="mt-4 w-full sm:w-auto glass-button-primary px-8 py-3.5 rounded-lg text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 min-h-[44px]"
          >
            Search Collection <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Search Chips */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#648698] mb-4">
            Popular Searches
          </h4>
          <div className="flex flex-wrap gap-2.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold uppercase tracking-wider bg-[#07242e] border border-[#648698]/30 hover:border-[#648698] text-[#CBCCC7] hover:text-white transition-all shadow-sm"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

