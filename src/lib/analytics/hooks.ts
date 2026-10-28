'use client'
import { useSyncExternalStore } from 'react'
import { analyticsReady, subscribeAnalytics } from './client'
export function useAnalyticsReady() {
  return useSyncExternalStore(subscribeAnalytics, analyticsReady, () => false)
}
