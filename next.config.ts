import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/**',
      },
    ],
    qualities: [90, 100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
      // Cloudflare R2 direct endpoint (e.g. <account>.r2.cloudflarestorage.com)
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        pathname: '/**',
      },
      // Custom R2 public domain / CDN (R2_PUBLIC_DOMAIN env var)
      ...(process.env.R2_PUBLIC_DOMAIN
        ? (() => {
            try {
              const r2Url = new URL(process.env.R2_PUBLIC_DOMAIN!)
              return [
                {
                  protocol: r2Url.protocol.replace(':', '') as 'http' | 'https',
                  hostname: r2Url.hostname,
                  pathname: '/**',
                },
              ]
            } catch {
              return []
            }
          })()
        : []),
    ],
  },
  reactStrictMode: true,
  redirects,
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig)
