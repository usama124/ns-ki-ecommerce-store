import type { MetadataRoute } from 'next'
import { SITE_ORIGIN } from '@/utilities/siteOrigin'

export default function robots(): MetadataRoute.Robots {
  return {
    host: SITE_ORIGIN,
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  }
}
