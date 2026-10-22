// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'payload'

const mocks = vi.hoisted(() => ({
  definitions: [] as Array<{ key: string[]; options: { tags: string[]; revalidate: number } }>,
  findGlobal: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ findGlobal: mocks.findGlobal }) }))
vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: () => unknown,
    key: string[],
    options: { tags: string[]; revalidate: number },
  ) => {
    mocks.definitions.push({ key, options })
    return fn
  },
  revalidateTag: mocks.revalidateTag,
}))

import { getCachedGlobal } from '@/utilities/getGlobals'
import { storefrontCachePlugin } from '@/plugins/storefrontCache'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.definitions.length = 0
})

describe('Public shell caching', () => {
  it('keeps relationship depth in cache identity and bounds stale data', async () => {
    mocks.findGlobal.mockResolvedValue({})
    await getCachedGlobal('footer', 0)()
    await getCachedGlobal('footer', 2)()
    expect(mocks.definitions[0].key).not.toEqual(mocks.definitions[1].key)
    expect(mocks.definitions[0].options).toMatchObject({
      revalidate: 60,
      tags: ['global_footer', 'storefront-shell'],
    })
    expect(mocks.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: false }),
    )
  })

  it('preserves existing hooks and invalidates navigation after category/global edits', async () => {
    const existing = vi.fn()
    const config = await storefrontCachePlugin({
      secret: 'unit-test-only',
      db: {} as Config['db'],
      collections: [{ slug: 'categories', fields: [], hooks: { afterChange: [existing] } }],
      globals: [{ slug: 'footer', fields: [] }],
    })
    expect(config.collections?.[0].hooks?.afterChange?.[0]).toBe(existing)
    const invalidate = config.collections?.[0].hooks?.afterChange?.[1]
    const doc = { id: 1 }
    await invalidate?.({ doc, req: { context: {} } } as never)
    expect(mocks.revalidateTag).toHaveBeenCalledWith('storefront-shell', { expire: 0 })
    expect(config.globals?.[0].hooks?.afterChange).toHaveLength(1)
  })
})
