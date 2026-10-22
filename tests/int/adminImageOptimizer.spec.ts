import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertEditableImage, encodeImage, fitAspectCrop, moveImageCrop, resizeImageCrop, scaleImageCrop, formatImageBytes, FULL_CROP, imageGeometry, loadEditableImage, type ImageSettings } from '@/utilities/adminImageOptimizer'

const settings: ImageSettings = { crop: FULL_CROP, maxWidth: 1600, maxHeight: 2400, quality: 85 }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Image optimizer geometry', () => {
  it.each([[2000, 2000], [4000, 2000], [1000, 3000]])('tightens a portrait crop on a %sx%s source without changing 2:3', (width, height) => {
    const fitted = fitAspectCrop(width, height, 2 / 3)
    const tight = scaleImageCrop(fitted, 0.5)
    expect(tight.width).toBeCloseTo(fitted.width / 2)
    expect(tight.height).toBeCloseTo(fitted.height / 2)
    expect(width * tight.width / (height * tight.height)).toBeCloseTo(2 / 3)
    const output = imageGeometry(width, height, { ...settings, crop: tight, aspectRatio: 'portrait' })
    expect(output.width * 3).toBe(output.height * 2)
    expect(output.sw * 3).toBe(output.sh * 2)
  })
  it.each(['nw', 'ne', 'sw', 'se'])('resizes using the %s corner and clamps movement inside the image', corner => {
    const crop = scaleImageCrop(fitAspectCrop(2000, 3000, 2 / 3), 0.6)
    for (const delta of [-1000, -15, 15, 1000]) {
      const resized = resizeImageCrop(crop, delta, delta, corner)
      expect(resized.width / resized.height).toBeCloseTo(crop.width / crop.height)
      expect(resized.x).toBeGreaterThanOrEqual(-1e-10)
      expect(resized.y).toBeGreaterThanOrEqual(-1e-10)
      expect(resized.x + resized.width).toBeLessThanOrEqual(100 + 1e-10)
      expect(resized.y + resized.height).toBeLessThanOrEqual(100 + 1e-10)
      expect(resized.width).toBeGreaterThan(0)
      expect(() => imageGeometry(2000, 3000, { ...settings, crop: resized, aspectRatio: 'portrait' })).not.toThrow()
    }
    expect(moveImageCrop(crop, 1000, -1000).x).toBeCloseTo(40)
    expect(moveImageCrop(crop, 1000, -1000).y).toBe(0)
  })
  it('keeps exact 2:3 output with odd dimensions, and rejects bounds too small for portrait pixels', () => {
    const output = imageGeometry(1001, 1501, { ...settings, crop: fitAspectCrop(1001, 1501, 2 / 3), maxWidth: 501, maxHeight: 751, aspectRatio: 'portrait' })
    expect(output).toMatchObject({ width: 500, height: 750 })
    expect(() => imageGeometry(100, 100, { ...settings, maxWidth: 1, aspectRatio: 'portrait' })).toThrow('too small')
  })
  it('fits landscape and portrait originals without stretching', () => {
    expect(imageGeometry(4000, 2000, settings)).toMatchObject({ width: 1600, height: 800 })
    expect(imageGeometry(2000, 4000, settings)).toMatchObject({ width: 1200, height: 2400 })
  })
  it('never enlarges small images and handles a one-pixel crop', () => {
    expect(imageGeometry(100, 200, settings)).toMatchObject({ width: 100, height: 200 })
    expect(imageGeometry(10, 10, { ...settings, crop: { x: 99, y: 99, width: 1, height: 1 } })).toMatchObject({ sx: 9, sy: 9, sw: 1, sh: 1, width: 1, height: 1 })
  })
  it('converts the percentage crop to source pixels before resizing', () => {
    expect(imageGeometry(4000, 3000, { ...settings, crop: { x: 25, y: 0, width: 50, height: 100 } })).toEqual({ sx: 1000, sy: 0, sw: 2000, sh: 3000, width: 1600, height: 2400 })
  })
  it.each([
    { maxWidth: 0 }, { maxHeight: 4097 }, { maxWidth: NaN }, { quality: 0 }, { quality: 101 },
    { crop: { x: -1, y: 0, width: 100, height: 100 } },
    { crop: { x: 50, y: 0, width: 51, height: 100 } },
    { crop: { x: 0, y: 0, width: 100, height: 0 } },
    { crop: { x: 0, y: 90, width: 100, height: 20 } },
  ])('rejects unsafe or invalid settings: %o', override => {
    expect(() => imageGeometry(2000, 3000, { ...settings, ...override })).toThrow()
  })
  it('rejects invalid and oversized sources', () => {
    for (const [w, h] of [[0, 100], [NaN, 100], [9000, 9000]]) expect(() => imageGeometry(w, h, settings)).toThrow()
  })
  it('formats before/after sizes', () => {
    expect(formatImageBytes(100)).toBe('100 B')
    expect(formatImageBytes(1536)).toBe('1.5 KB')
    expect(formatImageBytes(1048576)).toBe('1.00 MB')
  })
})

function fileWithBytes(type: string, bytes: number[]) {
  return { type, arrayBuffer: async () => new Uint8Array(bytes).buffer } as File
}
describe('Safe format handling', () => {
  it.each(['video/mp4', 'video/webm', 'image/svg+xml', 'image/gif'])('leaves %s out of the optimizer', async type => {
    await expect(assertEditableImage(fileWithBytes(type, []))).rejects.toThrow('supports JPEG')
  })
  it('rejects animated WebP and APNG while accepting static images', async () => {
    const webp = [...new Array(12).fill(0), ...Array.from('ANIM', char => char.charCodeAt(0)), 0, 0, 0, 0]
    const png = [...new Array(8).fill(0), 0, 0, 0, 0, ...Array.from('acTL', char => char.charCodeAt(0)), 0, 0, 0, 0]
    await expect(assertEditableImage(fileWithBytes('image/webp', webp))).rejects.toThrow('Animated')
    await expect(assertEditableImage(fileWithBytes('image/png', png))).rejects.toThrow('Animated')
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) await expect(assertEditableImage(fileWithBytes(type, []))).resolves.toBeUndefined()
  })
})

describe('WebP encoding', () => {
  function mockCanvas(blob: Blob | null = new Blob(['webp'], { type: 'image/webp' })) {
    const drawImage = vi.fn()
    const ctx = { drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: '' }
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx), toBlob: vi.fn((callback: BlobCallback) => callback(blob)) }
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
    return { canvas, ctx, drawImage }
  }
  it('encodes the selected crop/quality, preserves transparency (no background fill) and uses a WebP filename', async () => {
    const { canvas, drawImage } = mockCanvas()
    const image = { naturalWidth: 4000, naturalHeight: 2000 } as HTMLImageElement
    const result = await encodeImage(image, 'dress.original.PNG', settings)
    expect(result).toMatchObject({ width: 1600, height: 800 })
    expect(result.file.name).toBe('dress.original.webp')
    expect(result.file.type).toBe('image/webp')
    expect(result.file.size).toBe(4)
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 4000, 2000, 0, 0, 1600, 800)
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85)
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })
  it.each([null, new Blob(['png'], { type: 'image/png' })])('fails safely when encoding fails or the browser silently returns PNG', async blob => {
    const { canvas } = mockCanvas(blob)
    await expect(encodeImage({ naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement, 'test.jpg', settings)).rejects.toThrow()
    expect(canvas.width).toBe(0)
  })
  it('handles missing canvas support', async () => {
    const { canvas } = mockCanvas()
    canvas.getContext.mockReturnValue(null as never)
    await expect(encodeImage({ naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement, 'a.jpg', settings)).rejects.toThrow('not supported')
  })
  it.each([true, false])('cleans up decoded source URLs on success or failure (%s)', async success => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:source', revokeObjectURL: revoke })
    vi.stubGlobal('Image', class {
      naturalWidth = 100
      naturalHeight = 100
      onload?: () => void
      onerror?: () => void
      set src(_value: string) { queueMicrotask(() => success ? this.onload?.() : this.onerror?.()) }
    })
    const result = loadEditableImage(fileWithBytes('image/jpeg', []))
    if (success) await expect(result).resolves.toMatchObject({ naturalWidth: 100 })
    else await expect(result).rejects.toThrow('decoded')
    expect(revoke).toHaveBeenCalledWith('blob:source')
  })
})
