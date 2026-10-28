import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDatabaseOptions } from '@/utilities/databaseOptions'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const preview = vi.hoisted(() => ({
  refresh: vi.fn(),
  callback: undefined as undefined | (() => void),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: preview.refresh }) }))
vi.mock('@payloadcms/live-preview-react', () => ({
  RefreshRouteOnSave: ({ refresh }: { refresh: () => void }) => {
    preview.callback = refresh
    useEffect(() => {
      refresh()
    }, [refresh])
    return null
  },
}))

import { LivePreviewListener } from '@/components/LivePreviewListener'

let root: Root | undefined
function mountPreview() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(LivePreviewListener)))
}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.clearAllMocks()
})

describe('Preview refresh regression', () => {
  it('does not refresh on initial mount or a 404-style remount, but refreshes on a document update', () => {
    mountPreview()
    expect(preview.refresh).not.toHaveBeenCalled()
    act(() => root!.unmount())
    mountPreview()
    expect(preview.refresh).not.toHaveBeenCalled()
    preview.callback?.()
    expect(preview.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('Database connection budgets', () => {
  it('sets bounded idle pools and connection waits for both supported pooled adapters', () => {
    const options = getDatabaseOptions({})
    expect(options.mongo.maxPoolSize).toBe(5)
    expect(options.mongo.minPoolSize).toBe(0)
    expect(options.mongo.waitQueueTimeoutMS).toBe(10000)
    expect(options.postgres.max).toBe(5)
    expect(options.postgres.connectionTimeoutMillis).toBe(10000)
  })

  it('accepts overrides and rejects invalid pool/time limits', () => {
    expect(
      getDatabaseOptions({ DB_POOL_MAX: '3', DB_CONNECT_TIMEOUT_MS: '4000' }).mongo,
    ).toMatchObject({ maxPoolSize: 3, connectTimeoutMS: 4000 })
    expect(
      getDatabaseOptions({ DB_POOL_MAX: '-1', DB_CONNECT_TIMEOUT_MS: 'invalid' }).postgres,
    ).toMatchObject({ max: 5, connectionTimeoutMillis: 10000 })
  })
})
