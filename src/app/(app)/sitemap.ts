import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SITE_ORIGIN } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })
  const [products, categories, pages] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      select: { slug: true, updatedAt: true },
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'categories',
      select: { slug: true, updatedAt: true },
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'pages',
      where: { _status: { equals: 'published' } },
      select: { slug: true, updatedAt: true },
      draft: false,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
  ])

  const entries: MetadataRoute.Sitemap = ['', '/shop', '/sale'].map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
  }))

  for (const product of products.docs) {
    if (product.slug) {
      entries.push({
        url: `${SITE_ORIGIN}/products/${encodeURIComponent(product.slug)}`,
        lastModified: product.updatedAt,
      })
    }
  }

  for (const category of categories.docs) {
    if (category.slug) {
      entries.push({
        url: `${SITE_ORIGIN}/shop/${encodeURIComponent(category.slug)}`,
        lastModified: category.updatedAt,
      })
    }
  }

  // These slugs resolve to application routes rather than CMS content pages.
  const reservedSlugs = new Set([
    'shop', 'sale', 'products', 'login', 'logout', 'create-account',
    'forgot-password', 'account', 'orders', 'checkout', 'find-order',
    'track-order', 'store-admin', 'api', 'next', 'robots.txt', 'sitemap.xml',
  ])

  for (const page of pages.docs) {
    if (page.slug && page.slug !== 'home' && !reservedSlugs.has(page.slug)) {
      entries.push({
        url: `${SITE_ORIGIN}/${encodeURIComponent(page.slug)}`,
        lastModified: page.updatedAt,
      })
    }
  }

  return Array.from(new Map(entries.map((entry) => [entry.url, entry])).values())
}
