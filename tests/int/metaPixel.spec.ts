import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const route = vi.hoisted(() => ({ pathname: '/' as string | null }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
import { MetaPixelNoScript, MetaPixelScript } from '@/components/MetaPixel'
import { MetaPixelPageViews } from '@/components/MetaPixel/PageViews'

beforeEach(() => {
  route.pathname = '/'
  window.__nskiMetaInitialized = true
  window.__nskiMetaPath = '/'
  window.fbq = vi.fn()
})
afterEach(() => {
  cleanup()
  delete window.__nskiMetaInitialized
  delete window.__nskiMetaPath
  delete window.fbq
})
describe('Meta Pixel base integration', () => {
  it('renders the supplied pixel ID and one PageView command with an asynchronous loader', () => {
    const markup = renderToStaticMarkup(React.createElement(MetaPixelScript))
    expect(markup).toContain("fbq('init','1123550367331651')")
    expect(markup.match(/fbq\('track','PageView'\)/g)).toHaveLength(1)
    expect(markup).toContain('https://connect.facebook.net/en_US/fbevents.js')
    expect(markup).toContain('t.async=!0')
    expect(markup).toContain('if(!window.__nskiMetaInitialized)')
    expect(markup).not.toMatch(/Purchase|AddToCart/)
  })
  it('renders a single hidden noscript fallback without a newline in its URL', () => {
    const markup = renderToStaticMarkup(React.createElement(MetaPixelNoScript))
    expect(markup).toContain('https://www.facebook.com/tr?id=1123550367331651&amp;ev=PageView&amp;noscript=1')
    expect(markup.match(/<img /g)).toHaveLength(1)
    expect(markup).toContain('display:none')
  })
  it('does not repeat the initial view, including StrictMode and remounts', () => {
    const view = render(React.createElement(React.StrictMode, null, React.createElement(MetaPixelPageViews)))
    view.unmount()
    render(React.createElement(MetaPixelPageViews))
    expect(window.fbq).not.toHaveBeenCalled()
  })
  it('tracks one view per pathname change including back navigation', () => {
    const view = render(React.createElement(MetaPixelPageViews))
    route.pathname = '/products/esra-ns-16'
    view.rerender(React.createElement(MetaPixelPageViews))
    expect(window.fbq).toHaveBeenCalledExactlyOnceWith('track', 'PageView')
    view.rerender(React.createElement(MetaPixelPageViews))
    expect(window.fbq).toHaveBeenCalledTimes(1)
    route.pathname = '/'
    view.rerender(React.createElement(MetaPixelPageViews))
    expect(window.fbq).toHaveBeenCalledTimes(2)
  })
  it('does not throw or invent views if the base script is blocked or pathname unavailable', () => {
    window.__nskiMetaInitialized = false
    route.pathname = '/shop'
    const view = render(React.createElement(MetaPixelPageViews))
    expect(window.fbq).not.toHaveBeenCalled()
    route.pathname = null
    view.rerender(React.createElement(MetaPixelPageViews))
    expect(window.fbq).not.toHaveBeenCalled()
  })
})
