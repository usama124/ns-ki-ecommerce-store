import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock('geist/font/mono', () => ({ GeistMono: { variable: 'mono' } }))
vi.mock('geist/font/sans', () => ({ GeistSans: { variable: 'sans' } }))
vi.mock('@/components/AdminBar', () => ({ AdminBar: () => null }))
vi.mock('@/components/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/Header', () => ({ Header: () => null }))
vi.mock('@/components/LivePreviewListener', () => ({ LivePreviewListener: () => null }))
vi.mock('@/providers', () => ({ Providers: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/providers/Theme/InitTheme', () => ({ themeScriptCode: '/* theme */' }))

import RootLayout from '@/app/(app)/layout'
import GlobalNotFound from '@/app/global-not-found'

function assertTags(markup: string) {
  const document = new DOMParser().parseFromString(markup, 'text/html')
  // React can hoist resource links ahead of scripts during server rendering.
  const loader = document.head.querySelector('script')
  expect(loader?.id).toBe('google-tag-manager')
  expect(loader?.textContent).toContain("'GTM-PMHXK5RR'")
  expect(loader?.textContent).toContain('https://www.googletagmanager.com/gtm.js?id=')
  expect(document.querySelectorAll('#google-tag-manager')).toHaveLength(1)
  expect(document.body.firstElementChild?.tagName).toBe('NOSCRIPT')
  const iframe = document.body.firstElementChild?.querySelector('iframe')
  expect(iframe?.getAttribute('src')).toBe('https://www.googletagmanager.com/ns.html?id=GTM-PMHXK5RR')
  expect(iframe?.getAttribute('height')).toBe('0')
  expect(iframe?.getAttribute('width')).toBe('0')
  expect(iframe?.style.display).toBe('none')
  expect(iframe?.style.visibility).toBe('hidden')
  expect(document.querySelectorAll('iframe[src*="googletagmanager.com/ns.html"]')).toHaveLength(1)
  expect(markup).not.toContain('gtag/js')
  expect(markup).not.toContain("gtag('config'")
}

it('places exactly one GTM loader before other head scripts and its matching noscript first in body', async () => {
  const markup = renderToStaticMarkup(await RootLayout({ children: React.createElement('p', null, 'Store page') }))
  assertTags(markup)
  expect(markup).toContain('Store page')
})

it('includes GTM once on the standalone 404 document that bypasses the storefront layout', () => {
  const markup = renderToStaticMarkup(React.createElement(GlobalNotFound))
  assertTags(markup)
  expect(markup).toContain('This page could not be found.')
})

it('covers every public page through the storefront root without duplicating tags in nested layouts', () => {
  const app = path.resolve('src/app')
  const files = readdirSync(app, { recursive: true, encoding: 'utf8' })
  const pages = files.filter(file => file.endsWith('/page.tsx') && !file.startsWith('(payload)/'))
  expect(pages.length).toBeGreaterThan(10)
  for (const page of pages) expect(page.startsWith('(app)/')).toBe(true)
  const nestedLayouts = files.filter(file => file.startsWith('(app)/') && file.endsWith('/layout.tsx') && file !== '(app)/layout.tsx')
  for (const layout of nestedLayouts) {
    const content = readFileSync(path.join(app, layout), 'utf8')
    expect(content).not.toMatch(/GoogleTagManager|googletagmanager\.com/)
  }
})
