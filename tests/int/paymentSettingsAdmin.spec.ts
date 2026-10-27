// @vitest-environment node
import { expect, it, vi } from 'vitest'
const cache = vi.hoisted(() => ({ tag: vi.fn(), path: vi.fn() }))
vi.mock('next/cache.js', () => ({ revalidateTag: cache.tag, revalidatePath: cache.path }))
import { SiteSettings } from '@/globals/SiteSettings'
import { revalidateSiteSettings } from '@/hooks/revalidateSiteSettings'
it('exposes all four method switches with safe rollout defaults under admin-only global updates', async () => {
  const group = SiteSettings.fields.find(
    (field) => 'name' in field && field.name === 'paymentMethods',
  )
  if (!group || !('fields' in group)) throw new Error('Missing payment switches')
  expect(
    group.fields.map(
      (field) =>
        'name' in field && [field.name, 'defaultValue' in field ? field.defaultValue : null],
    ),
  ).toEqual([
    ['cod', false],
    ['bank_transfer', true],
    ['jazzcash', false],
    ['easypaisa', true],
  ])
  expect(await SiteSettings.access!.update!({ req: { user: null } } as never)).toBe(false)
  expect(
    await SiteSettings.access!.update!({ req: { user: { roles: ['customer'] } } } as never),
  ).toBe(false)
  expect(await SiteSettings.access!.update!({ req: { user: { roles: ['admin'] } } } as never)).toBe(
    true,
  )
})
it('invalidates site settings and the storefront after saving, without changing the saved data', async () => {
  const doc = { paymentMethods: { cod: true } }
  expect(
    await revalidateSiteSettings({
      doc,
      req: { context: {}, payload: { logger: { warn: vi.fn() } } },
    } as never),
  ).toBe(doc)
  expect(cache.tag).toHaveBeenCalledWith('global_site-settings', { expire: 0 })
  expect(cache.tag).toHaveBeenCalledWith('storefront-shell', { expire: 0 })
  expect(cache.path).toHaveBeenCalledWith('/', 'layout')
})
