import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

const legacy = vi.hoisted(() => ({ analytics: vi.fn(() => null) }))
vi.mock('@/components/Analytics', () => ({ Analytics: legacy.analytics }))
vi.mock('@/providers/Auth', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/providers/Cart', () => ({ CartProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/providers/HeaderTheme', () => ({ HeaderThemeProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/providers/Theme', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/providers/Sonner', () => ({ SonnerProvider: () => null }))

import { Providers } from '@/providers'

it('retains application providers without mounting the legacy direct-GA4 loader or consent UI alongside GTM', () => {
  const markup = renderToStaticMarkup(React.createElement(Providers, null, React.createElement('p', null, 'Store content')))
  expect(markup).toContain('Store content')
  expect(legacy.analytics).not.toHaveBeenCalled()
  expect(markup).not.toMatch(/gtag\/js|nski-analytics-loader|Cookie settings/)
})
