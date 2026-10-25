'use client'

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  browserAnalyticsConfig,
  chooseConsent,
  consentSnapshot,
  startAnalytics,
  stopAnalytics,
  subscribeAnalytics,
  syncAnalyticsRevocation,
  track,
} from '@/lib/analytics/client'
import { useAnalyticsReady } from '@/lib/analytics/hooks'

const enabledSnapshot = () => browserAnalyticsConfig().enabled

function PageViews() {
  const pathname = usePathname(),
    search = useSearchParams()
  const ready = useAnalyticsReady()
  const previous = useRef('')
  const key = `${pathname}?${search.toString()}`
  useEffect(() => {
    if (!ready) {
      previous.current = ''
      return
    }
    if (previous.current === key) return
    previous.current = key
    track('page_view')
  }, [ready, key])
  return null
}
export function Analytics({ deploymentAllowed = false }: { deploymentAllowed?: boolean }) {
  const pathname = usePathname()
  const consent = useSyncExternalStore(
    subscribeAnalytics,
    consentSnapshot,
    () => 'unknown' as const,
  )
  const [settings, setSettings] = useState(false)
  // The server has no window origin. Reuse its false snapshot for the first
  // hydration render, then show controls once browser configuration is known.
  const enabledInBrowser = useSyncExternalStore(subscribeAnalytics, enabledSnapshot, () => false)
  const enabled = deploymentAllowed && enabledInBrowser
  useEffect(() => {
    void syncAnalyticsRevocation()
    if (deploymentAllowed) startAnalytics()
    else stopAnalytics()
  }, [consent, pathname, deploymentAllowed])
  return (
    <>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      {enabled && (
        <>
          <button
            type="button"
            className="fixed bottom-16 left-2 z-30 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            onClick={() => setSettings(true)}
          >
            Cookie settings
          </button>
          {(consent === 'unknown' || settings) && (
            <section
              aria-label="Analytics preferences"
              className="fixed bottom-16 inset-x-3 z-[70] mx-auto max-w-xl rounded-xl border border-border bg-background p-4 text-foreground shadow-xl"
            >
              <p className="text-sm mb-3">
                May we use analytics cookies to understand store visits and shopping activity?
                Optional analytics stays off unless you accept. Advertising tracking stays off.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded border border-border px-4 py-2 text-sm"
                  onClick={() => {
                    chooseConsent('denied')
                    setSettings(false)
                  }}
                >
                  Reject analytics
                </button>
                <button
                  type="button"
                  className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
                  onClick={() => {
                    chooseConsent('granted')
                    setSettings(false)
                  }}
                >
                  Accept analytics
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
