import React, { act } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({
  usePathname: () => '/shop',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/analytics/client', () => ({
  browserAnalyticsConfig: () => ({ enabled: true }),
  consentSnapshot: () => 'unknown',
  subscribeAnalytics: () => () => {},
  startAnalytics: () => {},
  stopAnalytics: () => {},
  syncAnalyticsRevocation: async () => {},
  chooseConsent: () => {},
  analyticsReady: () => false,
  track: () => {},
}))
import { Analytics } from '@/components/Analytics'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
describe('analytics SSR controls', () => {
  it('does not produce origin-dependent server markup that mismatches hydration', () => {
    const html = renderToString(React.createElement(Analytics, { deploymentAllowed: true }))
    expect(html).not.toContain('Analytics preferences')
    expect(html).not.toContain('Cookie settings')
    const container = document.createElement('div'),
      root = createRoot(container)
    act(() => root.render(React.createElement(Analytics, { deploymentAllowed: true })))
    expect(container.textContent).toContain('Cookie settings')
    expect(container.textContent).toContain('Accept analytics')
    act(() => root.unmount())
  })
})
