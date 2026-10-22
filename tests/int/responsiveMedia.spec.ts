import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { responsiveMedia } from '@/utilities/responsiveMedia'
import { ResponsiveImage } from '@/components/Media/ResponsiveImage'
import { ProductCard } from '@/components/products/ProductCard'
import { Gallery } from '@/components/product/Gallery'

vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt, 'data-next-fallback': true }) }))
const media = {
  url: '/original.webp', width: 1600, height: 2400,
  sizes: {
    thumbnail: { url: '/thumbnail.webp', width: 300 },
    card: { url: '/card.webp', width: 600 },
    hero: { url: '/hero.webp', width: 1600 },
  },
}
describe('Stored responsive media', () => {
  it('uses card as default and sorted actual width descriptors, preferring derivatives over same-width originals', () => {
    expect(responsiveMedia(media)).toEqual({ src: '/card.webp', srcSet: '/thumbnail.webp 300w, /card.webp 600w, /hero.webp 1600w' })
  })
  it('uses thumbnail/hero defaults and retains the original for zoom', () => {
    expect(responsiveMedia(media, 'thumbnail').src).toBe('/thumbnail.webp')
    expect(responsiveMedia(media, 'hero').src).toBe('/hero.webp')
    expect(responsiveMedia(media, 'original')).toEqual({ src: '/original.webp', srcSet: undefined })
  })
  it('keeps larger originals as a high-density candidate', () => {
    expect(responsiveMedia({ ...media, width: 2400 }).srcSet).toContain('/original.webp 2400w')
  })
  it.each([null, undefined, 123, '507f1f77bcf86cd799439011', { id: '123' }])('does not treat missing/unpopulated relations as URLs: %o', value => {
    expect(responsiveMedia(value).src).toBeUndefined()
  })
  it('handles URL-only legacy uploads and string URLs without inventing derivatives', () => {
    expect(responsiveMedia({ url: '/old.jpg' })).toEqual({ src: '/old.jpg', srcSet: undefined })
    expect(responsiveMedia('https://cdn.example/file.jpg').src).toBe('https://cdn.example/file.jpg')
  })
  it('falls back when the original or a derivative is missing', () => {
    expect(responsiveMedia({ sizes: media.sizes }, 'original').src).toBe('/hero.webp')
    expect(responsiveMedia({ url: '/old.jpg', sizes: { thumbnail: media.sizes.thumbnail } }).src).toBe('/old.jpg')
  })
  it('ignores invalid widths and safely encodes URL delimiters in srcset', () => {
    const result = responsiveMedia({ ...media, sizes: { ...media.sizes, card: { url: '/a b,c.webp', width: 600 }, thumbnail: { url: '/bad', width: NaN } } })
    expect(result.srcSet).toBe('/a%20b%2Cc.webp 600w, /hero.webp 1600w')
  })
  it.each(['image/gif', 'image/svg+xml'])('keeps %s originals intact', mimeType => {
    expect(responsiveMedia({ ...media, mimeType })).toEqual({ src: '/original.webp', srcSet: undefined })
  })
  it('renders native width candidates, layout styles and lazy loading without Next re-encoding', () => {
    const html = renderToStaticMarkup(React.createElement(ResponsiveImage, { media, alt: 'Product', fill: true, sizes: '50vw' }))
    expect(html).toContain('srcSet="/thumbnail.webp 300w, /card.webp 600w, /hero.webp 1600w"')
    expect(html).toContain('sizes="50vw"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('position:absolute')
    expect(html).not.toContain('data-next-fallback')
  })
  it('preserves priority and the legacy Next image fallback', () => {
    const html = renderToStaticMarkup(React.createElement(ResponsiveImage, { media, alt: 'Hero', fill: true, priority: true }))
    expect(html).toContain('fetchPriority="high"')
    expect(html).toContain('loading="eager"')
    expect(renderToStaticMarkup(React.createElement(ResponsiveImage, { media: { url: '/legacy.jpg' }, alt: 'Old', fill: true }))).toContain('data-next-fallback')
  })
  it('wires the product card to the stored variants rather than the main URL', () => {
    const html = renderToStaticMarkup(React.createElement(ProductCard, { product: { title: 'Suit', slug: 'suit', images: [{ image: media }] } }))
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    expect(parsed.querySelector('img')?.getAttribute('src')).toBe('/card.webp')
    expect(parsed.querySelector('img')?.getAttribute('srcset')).toContain('/thumbnail.webp 300w')
  })
  it('wires the gallery main preview and thumbnails with separate layout sizes and priority', () => {
    const image = { ...media, id: 1, createdAt: '', updatedAt: '' }
    const html = renderToStaticMarkup(React.createElement(Gallery, { gallery: [{ image }, { image }] }))
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const images = parsed.querySelectorAll('img')
    expect(images[0].getAttribute('srcset')).toContain('/hero.webp 1600w')
    expect(images[0].getAttribute('loading')).toBe('eager')
    expect(images[1].getAttribute('src')).toBe('/thumbnail.webp')
    expect(images[1].getAttribute('sizes')).toBe('80px')
    expect(images[1].getAttribute('loading')).toBe('lazy')
  })
})
