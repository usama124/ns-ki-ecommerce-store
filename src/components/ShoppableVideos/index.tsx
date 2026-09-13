'use client'

import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'
import { ShoppingBag, Volume2, VolumeX, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

type Reel = {
  id?: string
  title?: string
  video?: any
  poster?: any
  linkedProduct?: any
}

type Props = {
  reels: Reel[]
}

/** Resolve size/color from a relationship object { id, name } or a legacy string */
function resolveSizeName(size: any): string {
  if (!size) return ''
  if (typeof size === 'object') return size.name || ''
  return String(size)
}

function resolveColorName(color: any): string {
  if (!color) return ''
  if (typeof color === 'object') return color.name || ''
  return String(color)
}

export function ShoppableVideos({ reels = [] }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [mutedStates, setMutedStates] = useState<{ [key: number]: boolean }>({})
  const { addItem } = useCart()

  if (!reels || reels.length === 0) return null

  return (
    <section className="py-16 bg-neutral-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.3em] font-semibold text-gray-500 block mb-2">
            Interactive Experience
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-[0.15em] uppercase text-black">
            Shop By Video
          </h2>
        </div>

        {/* Horizontal Reels Container */}
        <div className="flex space-x-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-none">
          {reels.map((reel, index) => (
            <VideoCard
              key={index}
              reel={reel}
              index={index}
              onQuickShop={(product) => {
                setSelectedProduct(product)
                if (product?.variants?.length > 0) {
                  const firstInStock = product.variants.find((v: any) => v.stock > 0)
                  const firstVariant = firstInStock || product.variants[0]
                  setSelectedSize(resolveSizeName(firstVariant?.size))
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Quick Shop Drawer Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white p-6 shadow-2xl rounded-xs">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-black"
            >
              <X className="h-5 w-5" />
            </button>

            {(() => {
              const selectedVariant = selectedProduct.variants?.find(
                (v: any) => resolveSizeName(v.size) === selectedSize,
              )
              const activePrice = selectedVariant?.pricePKR ?? selectedProduct.basePricePKR

              return (
                <>
                  <div className="flex gap-4 mb-6">
                    {/* Product Thumbnail */}
                    {selectedProduct.images?.[0]?.image && (
                      <div className="relative w-24 h-32 bg-gray-100 flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={
                            typeof selectedProduct.images[0].image === 'object'
                              ? selectedProduct.images[0].image.url
                              : selectedProduct.images[0].image
                          }
                          alt={selectedProduct.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}

                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold block mb-1">
                        Quick Add
                      </span>
                      <h3 className="font-serif text-lg font-medium text-stone-900 uppercase tracking-wider mb-2">
                        {selectedProduct.title}
                      </h3>
                      <p className="text-base font-serif font-bold text-stone-900 mb-1.5 flex items-center gap-2 flex-wrap">
                        {formatPKR(activePrice)}
                        {selectedVariant?.pricePKR && (
                          <span className="text-[10px] uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 font-sans font-medium rounded border border-amber-200">
                            Special Price
                          </span>
                        )}
                      </p>
                      <div>
                        {selectedVariant &&
                        selectedVariant.stock <= 0 &&
                        !selectedVariant.allowBackorder ? (
                          <span className="inline-block text-[11px] uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 font-medium rounded border border-red-200">
                            Out of Stock
                          </span>
                        ) : selectedVariant &&
                          selectedVariant.stock <= 0 &&
                          selectedVariant.allowBackorder ? (
                          <span className="inline-block text-[11px] uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 font-medium rounded border border-amber-200">
                            Available on Backorder
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] uppercase tracking-wider text-green-800 bg-green-50 px-2 py-0.5 font-medium rounded border border-green-200">
                            In Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Size Selector */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                    <div className="mb-6">
                      <label className="block text-xs uppercase tracking-widest font-semibold text-stone-900 mb-3">
                        Select Size
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {selectedProduct.variants.map((variant: any, idx: number) => {
                          const sizeName = resolveSizeName(variant.size)
                          const outOfStock = variant.stock <= 0
                          const isSelected = selectedSize === sizeName

                          return (
                            <button
                              key={idx}
                              disabled={outOfStock && !variant.allowBackorder}
                              onClick={() => setSelectedSize(sizeName)}
                              className={`py-2 text-xs uppercase tracking-wider border font-medium transition-all ${
                                isSelected
                                  ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                                  : outOfStock && !variant.allowBackorder
                                    ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50'
                                    : 'border-stone-300 text-stone-800 hover:border-stone-900'
                              }`}
                            >
                              {sizeName}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      disabled={!selectedSize}
                      onClick={() => {
                        const imageUrl =
                          typeof selectedProduct.images?.[0]?.image === 'object'
                            ? selectedProduct.images[0].image.url
                            : undefined

                        addItem({
                          productId: selectedProduct.id,
                          slug: selectedProduct.slug,
                          title: selectedProduct.title,
                          imageUrl,
                          variantSize: selectedSize || 'Unstitched',
                          variantSku: selectedVariant?.sku,
                          price: activePrice,
                        })

                        setSelectedProduct(null)
                      }}
                      className="w-full bg-stone-900 text-white py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-stone-800 transition-colors disabled:bg-stone-300 shadow-sm"
                    >
                      Add To Bag
                    </button>

                    <Link
                      href={`/products/${selectedProduct.slug}`}
                      onClick={() => setSelectedProduct(null)}
                      className="w-full text-center text-xs uppercase tracking-widest text-stone-500 hover:text-stone-900 py-2 font-medium"
                    >
                      View Full Details
                    </Link>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </section>
  )
}

function VideoCard({
  reel,
  index,
  onQuickShop,
}: {
  reel: Reel
  index: number
  onQuickShop: (p: any) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const videoUrl = typeof reel.video === 'object' ? reel.video?.url : reel.video
  const posterUrl = typeof reel.poster === 'object' ? reel.poster?.url : reel.poster
  const product = reel.linkedProduct

  // IntersectionObserver to auto-play when in view
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {})
        } else {
          video.pause()
          setIsPlaying(false)
        }
      },
      { threshold: 0.6 },
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  return (
    <div className="relative flex-none w-64 sm:w-72 aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-lg snap-center group">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          muted={isMuted}
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      ) : posterUrl ? (
        <Image src={posterUrl} alt={reel.title || 'Reel'} fill className="object-cover" />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Top Header */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-white z-10">
        <span className="text-[10px] font-semibold uppercase tracking-widest bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/20">
          {reel.title || 'LUJAIN Style'}
        </span>
        <button
          onClick={toggleMute}
          className="p-2 rounded-full bg-black/40 backdrop-blur-xs hover:bg-black/60 text-white transition-colors"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Bottom Quick Shop Bar */}
      {product && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-white/95 backdrop-blur-md p-3 rounded-md shadow-lg flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-black truncate uppercase tracking-wider">
                {product.title}
              </h4>
              <p className="text-xs font-semibold text-gray-900">
                {formatPKR(product.basePricePKR)}
              </p>
            </div>

            <button
              onClick={() => onQuickShop(product)}
              className="bg-black text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <ShoppingBag className="h-3 w-3" />
              Quick Shop
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
