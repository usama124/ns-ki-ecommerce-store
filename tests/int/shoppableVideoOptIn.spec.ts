import { describe, expect, it, vi } from 'vitest'
import { autoSyncShoppableVideo, removeShoppableVideoOnDelete } from '@/collections/Products/hooks/autoSyncShoppableVideo'
import { isVisibleShoppableReel } from '@/utilities/shoppableVideoVisibility'

function request(reels: unknown[] = []) {
  return { context: {}, payload: {
    findGlobal: vi.fn().mockResolvedValue({ shoppableVideos: reels }),
    updateGlobal: vi.fn().mockResolvedValue({}), logger: { error: vi.fn() },
  } }
}
const product = { id: 1, title: 'Winter suit', productVideo: 10, images: [{ image: 20 }], status: 'published', showInShopByVideo: true }
const sync = (doc: Record<string, unknown>, req: ReturnType<typeof request>) => autoSyncShoppableVideo({ doc, req } as never)
describe('Explicit homepage video opt-in', () => {
  it('adds a reel only for an opted-in published product and threads the request through nested operations', async () => {
    const req = request()
    expect(await sync(product, req)).toEqual(product)
    expect(req.payload.findGlobal).toHaveBeenCalledWith(expect.objectContaining({ req, depth: 0 }))
    expect(req.payload.updateGlobal).toHaveBeenCalledWith({ slug: 'homepage', req, data: { shoppableVideos: [{ title: product.title, video: 10, poster: 20, linkedProduct: 1 }] } })
  })
  it.each([
    { showInShopByVideo: false }, { showInShopByVideo: undefined }, { status: 'draft' },
    { productVideo: null }, { _status: 'draft' },
  ])('never adds a product reel when eligibility is missing: %o', async overrides => {
    const req = request()
    await sync({ ...product, ...overrides }, req)
    expect(req.payload.updateGlobal).not.toHaveBeenCalled()
  })
  it('updates an existing reel, preserving its row ID and unrelated manually curated content', async () => {
    const manual = { title: 'Brand reel', video: 99 }
    const req = request([manual, { id: 'row-1', linkedProduct: { id: 1 }, video: 5 }])
    await sync({ ...product, productVideo: { id: 10 }, images: [{ image: { id: 20 } }] }, req)
    expect(req.payload.updateGlobal.mock.calls[0][0].data.shoppableVideos).toEqual([manual, { id: 'row-1', linkedProduct: 1, video: 10, poster: 20, title: 'Winter suit' }])
  })
  it.each([{ showInShopByVideo: false }, { status: 'draft' }, { productVideo: null }])('removes all matching stale reels when opted out, unpublished, or video removed: %o', async overrides => {
    const req = request([{ linkedProduct: 1 }, { linkedProduct: { id: '1' } }, { linkedProduct: 2 }])
    await sync({ ...product, ...overrides }, req)
    expect(req.payload.updateGlobal.mock.calls[0][0].data.shoppableVideos).toEqual([{ linkedProduct: 2 }])
  })
  it('honors the loop guard and fails without interrupting the product save on global sync errors', async () => {
    const req = request()
    req.context = { skipShoppableVideoSync: true }
    await sync(product, req)
    expect(req.payload.findGlobal).not.toHaveBeenCalled()
    req.context = {}
    req.payload.findGlobal.mockRejectedValueOnce(new Error('unavailable'))
    expect(await sync(product, req)).toEqual(product)
    expect(req.payload.logger.error).toHaveBeenCalled()
  })
  it('removes deleted product reels and retains unrelated reels in the same transaction', async () => {
    const req = request([{ linkedProduct: { id: 1 } }, { linkedProduct: 2 }])
    await removeShoppableVideoOnDelete({ id: 1, req } as never)
    expect(req.payload.updateGlobal).toHaveBeenCalledWith({ slug: 'homepage', req, data: { shoppableVideos: [{ linkedProduct: 2 }] } })
  })
  it('filters legacy non-opted-in, unresolved and draft linked reels even before the next product save', () => {
    expect(isVisibleShoppableReel({ linkedProduct: product })).toBe(true)
    for (const linkedProduct of [1, { ...product, showInShopByVideo: undefined }, { ...product, showInShopByVideo: false }, { ...product, status: 'draft' }, { ...product, productVideo: null }]) {
      expect(isVisibleShoppableReel({ linkedProduct })).toBe(false)
    }
    expect(isVisibleShoppableReel({})).toBe(true)
  })
})
