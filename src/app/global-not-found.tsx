import type { Metadata } from 'next'
import { GoogleTagManagerNoScript, GoogleTagManagerScript } from '@/components/GoogleTagManager'
import './(app)/globals.css'

export const metadata: Metadata = {
  title: 'Page not found | Siblings by N’s KI',
  robots: { index: false, follow: true },
}

// Multiple root layouts (storefront and Payload) need an independent fallback.
// Unknown multi-segment routes must not initialize the CMS or refresh the router.
export default function GlobalNotFound() {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <GoogleTagManagerScript />
      </head>
      <body>
        <GoogleTagManagerNoScript />
        <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
          <h1 className="text-4xl font-semibold">404</h1>
          <p>This page could not be found.</p>
          {/* A document navigation escapes a failed app-router boundary. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="rounded-lg border border-current px-6 py-3">
            Go home
          </a>
        </main>
      </body>
    </html>
  )
}
