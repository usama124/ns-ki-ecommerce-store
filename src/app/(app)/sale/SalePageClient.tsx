'use client'

import { ProductGrid } from '@/components/products/ProductGrid'
import { Clock, Filter, Mail, Sparkles, Tag } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  isLive: boolean
  saleSettings: any
  initialProducts: any[]
  subcategories: { id: string; name: string }[]
}

export function SalePageClient({
  isLive,
  saleSettings,
  initialProducts,
  subcategories,
}: Props) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')
  const [timeLeft, setTimeLeft] = useState<{ hours: string; mins: string; secs: string }>({
    hours: '00',
    mins: '00',
    secs: '00',
  })
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  // Real-time countdown ticker
  useEffect(() => {
    if (!saleSettings?.endDate || !isLive) return

    const interval = setInterval(() => {
      const now = Date.now()
      const end = new Date(saleSettings.endDate).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft({ hours: '00', mins: '00', secs: '00' })
        clearInterval(interval)
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const secs = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft({
          hours: hours.toString().padStart(2, '0'),
          mins: mins.toString().padStart(2, '0'),
          secs: secs.toString().padStart(2, '0'),
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [saleSettings?.endDate, isLive])

  // Filter products by subcategory
  const filteredProducts =
    selectedSubcategory === 'all'
      ? initialProducts
      : initialProducts.filter((p) => {
          if (Array.isArray(p.categories)) {
            return p.categories.some((c: any) =>
              typeof c === 'object' ? c.id === selectedSubcategory : c === selectedSubcategory,
            )
          }
          return false
        })

  const discount = saleSettings?.discountPercentage || 20

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail) return
    setSubscribed(true)
    toast.success('Thank you! You will be notified before our next flash sale.')
  }

  if (!isLive || initialProducts.length === 0) {
    return (
      <div className="min-h-[70vh] bg-[#03171E] text-white flex flex-col items-center justify-center px-4 py-16 pb-24 sm:pb-12">
        <div className="max-w-md w-full text-center space-y-6 bg-white/5 backdrop-blur-md p-8 sm:p-12 rounded-3xl border border-white/10 shadow-2xl">
          <div className="w-16 h-16 bg-[#648698]/20 rounded-2xl flex items-center justify-center mx-auto border border-[#648698]/40 text-[#CBCCC7]">
            <Tag className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              No Active Sale Right Now
            </h1>
            <p className="text-sm text-[#CBCCC7]/80">
              There is no active flash sale campaign at the moment. Stay tuned for our next seasonal event!
            </p>
          </div>

          <form onSubmit={handleNewsletterSubmit} className="space-y-3 pt-2">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CBCCC7]/60" />
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email for early access"
                required
                disabled={subscribed}
                className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={subscribed}
              className="w-full bg-white text-[#03171E] font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-[#CBCCC7] transition-colors disabled:opacity-50 shadow-md"
            >
              {subscribed ? 'Subscribed ✓' : 'Notify Me'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#03171E] text-[#CBCCC7] pb-24 sm:pb-12">
      {/* HERO SECTION */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#800020]/40 via-[#03171E] to-[#03171E] border-b border-white/10 px-4 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#dc2626]/20 border border-[#dc2626]/50 px-4 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD700] animate-pulse" />
            <span>FLAT {discount}% OFF</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
            {saleSettings?.title || 'Exclusive Flash Sale'}
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-[#CBCCC7]/90 leading-relaxed">
            {saleSettings?.announcementText ||
              'Explore handpicked luxury unstitched and ready-to-wear collections at exclusive discounted prices.'}
          </p>

          {/* COUNTDOWN TIMER */}
          {saleSettings?.endDate && (
            <div className="pt-2 flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-semibold text-[#CBCCC7]/70 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#dc2626]" /> Sale Ends In
              </span>
              <div className="flex items-center gap-2 sm:gap-3 text-white font-mono font-bold">
                <div className="bg-white/10 border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-center min-w-[60px]">
                  <span className="text-xl sm:text-3xl block text-[#FFD700]">{timeLeft.hours}</span>
                  <span className="text-[10px] text-[#CBCCC7]/70 uppercase tracking-wider block font-sans">
                    Hours
                  </span>
                </div>
                <span className="text-xl sm:text-2xl text-white/50">:</span>
                <div className="bg-white/10 border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-center min-w-[60px]">
                  <span className="text-xl sm:text-3xl block text-[#FFD700]">{timeLeft.mins}</span>
                  <span className="text-[10px] text-[#CBCCC7]/70 uppercase tracking-wider block font-sans">
                    Mins
                  </span>
                </div>
                <span className="text-xl sm:text-2xl text-white/50">:</span>
                <div className="bg-white/10 border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-center min-w-[60px]">
                  <span className="text-xl sm:text-3xl block text-[#FFD700]">{timeLeft.secs}</span>
                  <span className="text-[10px] text-[#CBCCC7]/70 uppercase tracking-wider block font-sans">
                    Secs
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* SUBCATEGORY QUICK-FILTER BAR */}
        {subcategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none border-b border-white/10 mb-8">
            <span className="text-xs uppercase font-bold text-[#CBCCC7]/60 flex items-center gap-1 shrink-0 mr-2">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>

            <button
              type="button"
              onClick={() => setSelectedSubcategory('all')}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all shrink-0 ${
                selectedSubcategory === 'all'
                  ? 'bg-white text-[#03171E] font-bold shadow-md'
                  : 'bg-white/5 text-[#CBCCC7] hover:bg-white/10'
              }`}
            >
              All Sale ({initialProducts.length})
            </button>

            {subcategories.map((cat) => {
              const isSelected = selectedSubcategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedSubcategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all shrink-0 ${
                    isSelected
                      ? 'bg-white text-[#03171E] font-bold shadow-md'
                      : 'bg-white/5 text-[#CBCCC7] hover:bg-white/10'
                  }`}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* PRODUCT GRID */}
        <ProductGrid
          products={filteredProducts}
          emptyMessage="No products found matching this filter category."
        />
      </div>
    </div>
  )
}
