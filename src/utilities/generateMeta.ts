import type { Metadata } from 'next'
import type { Page, Product } from '../payload-types'
import { mergeOpenGraph } from './mergeOpenGraph'

export const generateMeta = async (args: { doc: Page | Product | null }): Promise<Metadata> => {
  const { doc } = args || {}
  const pageDoc = doc as any

  const metaImage = pageDoc?.meta?.image
  const ogImage =
    typeof metaImage === 'object' && metaImage !== null && 'url' in metaImage
      ? `${process.env.NEXT_PUBLIC_SERVER_URL}${metaImage.url}`
      : undefined

  const title = pageDoc?.meta?.title || pageDoc?.title || "N's KI | Pakistani Luxury Fashion"
  const description = pageDoc?.meta?.description || "N's KI Pakistani Luxury Fashion & E-Commerce"

  return {
    description,
    openGraph: mergeOpenGraph({
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      title,
      url: Array.isArray(pageDoc?.slug) ? pageDoc?.slug.join('/') : '/',
    }),
    title,
  }
}
