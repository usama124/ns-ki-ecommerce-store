'use client'

import React, { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingBag, X, Volume2, VolumeX, Play } from 'lucide-react'
import { useCart } from '@/providers/Cart'
import { formatPKR } from '@/utilities/formatPKR'

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
                  setSelectedSize(firstInStock ? firstInStock.size : product.variants[0].size)
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

            <div className="flex gap-4 mb-6">
              {/* Product Thumbnail */}
              {selectedProduct.images?.[0]?.image && (
                <div className="relative w-24 h-32 bg-gray-100 flex-shrink-0">
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

              <div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">
                  Quick Add
                </span>
                <h3 className="font-serif text-lg font-medium text-black uppercase tracking-wider mb-2">
                  {selectedProduct.title}
                </h3>
                <p className="text-sm font-semibold text-black mb-1">
                  {formatPKR(selectedProduct.basePricePKR)}
                </p>
                <span className="inline-block text-[11px] uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 font-medium">
                  In Stock
                </span>
              </div>
            </div>

            {/* Size Selector */}
            {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-widest font-semibold text-gray-700 mb-3">
                  Select Size
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {selectedProduct.variants.map((variant: any, idx: number) => {
                    const outOfStock = variant.stock <= 0
                    const isSelected = selectedSize === variant.size

                    return (
                      <button
                        key={idx}
                        disabled={outOfStock}
                        onClick={() => setSelectedSize(variant.size)}
                        className={`py-2 text-xs uppercase tracking-wider border font-medium transition-all ${
                          isSelected
                            ? 'border-black bg-black text-white'
                            : outOfStock
                            ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50'
                            : 'border-gray-300 text-gray-700 hover:border-black'
                        }`}
                      >
                        {variant.size}
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
                  const variant = selectedProduct.variants?.find((v: any) => v.size === selectedSize)
                  const price = variant?.pricePKR || selectedProduct.basePricePKR
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
                    variantSku: variant?.sku,
                    price,
                  })

                  setSelectedProduct(null)
                }}
                className="w-full bg-black text-white py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors disabled:bg-gray-300"
              >
                Add To Bag
              </button>

              <Link
                href={`/products/${selectedProduct.slug}`}
                onClick={() => setSelectedProduct(null)}
                className="w-full text-center text-xs uppercase tracking-widest text-gray-500 hover:text-black py-2"
              >
                View Full Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function VideoCard({ reel, index, onQuickShop }: { reel: Reel; index: number; onQuickShop: (p: any) => void }) {
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
          video.play().then(() => setIsPlaying(true)).catch(() => {})
        } else {
          video.pause()
          setIsPlaying(false)
        }
      },
      { threshold: 0.6 }
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
