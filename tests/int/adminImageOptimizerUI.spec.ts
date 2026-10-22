import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const state = vi.hoisted(() => ({
  value: undefined as File | null | undefined,
  data: {} as Record<string, unknown>,
  allowed: true,
  processing: false,
  setValue: vi.fn(), reset: vi.fn(), modified: vi.fn(), load: vi.fn(), encode: vi.fn(),
}))
vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: state.value, setValue: state.setValue, formProcessing: state.processing }),
  useDocumentInfo: () => ({ data: state.data, hasSavePermission: state.allowed }),
  useForm: () => ({ setModified: state.modified }),
  useUploadEdits: () => ({ resetUploadEdits: state.reset }),
}))
vi.mock('@/utilities/adminImageOptimizer', async importOriginal => ({
  ...await importOriginal<typeof import('@/utilities/adminImageOptimizer')>(),
  loadEditableImage: state.load,
  encodeImage: state.encode,
}))
import { ImageOptimizer } from '@/components/admin/ImageOptimizer'

let root: Root
let container: HTMLDivElement
const revoke = vi.fn()
function render() { act(() => root.render(React.createElement(ImageOptimizer))) }
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(text))
  expect(button, `button ${text}`).toBeTruthy()
  await act(async () => { button!.click() })
}
async function preview() { await act(async () => { await vi.advanceTimersByTimeAsync(350) }) }
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: revoke })
  state.value = new File(['original bytes'], 'dress.jpg', { type: 'image/jpeg' })
  state.data = {}
  state.allowed = true
  state.processing = false
  state.load.mockResolvedValue({ naturalWidth: 1000, naturalHeight: 1500 })
  state.encode.mockResolvedValue({ file: new File(['webp'], 'dress.webp', { type: 'image/webp' }), width: 1000, height: 1500 })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  render()
})
afterEach(() => {
  act(() => root.unmount())
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
describe('Admin image optimizer integration', () => {
  it('previews original and encoded sizes without modifying the upload until Apply', async () => {
    await click('Edit, crop')
    await preview()
    expect(container.textContent).toContain('14 B')
    expect(container.textContent).toContain('4 B')
    expect(state.setValue).not.toHaveBeenCalled()
    await click('Apply WebP')
    expect(state.setValue).toHaveBeenCalledWith(expect.objectContaining({ name: 'dress.webp', type: 'image/webp' }))
    expect(state.reset).toHaveBeenCalledOnce()
    expect(state.modified).toHaveBeenCalledWith(true)
  })
  it('cancels without changing original file or native crop state and releases preview URLs', async () => {
    await click('Edit, crop')
    await preview()
    await click('Cancel / keep')
    expect(state.setValue).not.toHaveBeenCalled()
    expect(state.reset).not.toHaveBeenCalled()
    expect(container.querySelector('fieldset')).toBeNull()
    expect(revoke).toHaveBeenCalled()
  })
  it('passes a centered portrait crop to the encoder', async () => {
    state.load.mockResolvedValueOnce({ naturalWidth: 2000, naturalHeight: 2000 })
    await click('Edit, crop')
    await click('Product portrait')
    await preview()
    expect(state.encode.mock.lastCall?.[2].crop).toMatchObject({ y: 0, height: 100 })
    expect(state.encode.mock.lastCall?.[2].crop.width).toBeCloseTo(66.6667, 3)
  })
  it('can tighten and reposition a selected portrait area with its ratio locked', async () => {
    state.load.mockResolvedValueOnce({ naturalWidth: 2000, naturalHeight: 2000 })
    await click('Edit, crop')
    await click('Product portrait')
    const selection = container.querySelector('[aria-label="Selected crop area"]')!
    await act(async () => {
      selection.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }))
    })
    await act(async () => {
      selection.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    await preview()
    const settings = state.encode.mock.lastCall?.[2]
    expect(settings.aspectRatio).toBe('portrait')
    expect(settings.crop.width).toBeCloseTo(66.6666667 * 0.95)
    expect(settings.crop.height).toBeCloseTo(95)
    expect(settings.crop.y).toBeCloseTo(3.5)
    expect(container.textContent).toContain('2:3 portrait locked')
  })
  it('supports pointer dragging a crop corner inward and then moving the selection', async () => {
    await click('Edit, crop')
    await click('Product portrait')
    const frame = container.querySelector('.admin-image-optimizer__original')! as HTMLDivElement
    frame.setPointerCapture = vi.fn()
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ width: 200, height: 300 } as DOMRect)
    const pointer = (target: Element, type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      target.dispatchEvent(event)
    }
    await act(async () => {
      pointer(container.querySelector('[data-corner="se"]')!, 'pointerdown', 200, 300)
      pointer(frame, 'pointermove', 120, 180)
      pointer(frame, 'pointerup', 120, 180)
    })
    await act(async () => {
      pointer(container.querySelector('[aria-label="Selected crop area"]')!, 'pointerdown', 60, 90)
      pointer(frame, 'pointermove', 80, 120)
      pointer(frame, 'pointerup', 80, 120)
    })
    await preview()
    for (const [key, value] of Object.entries({ x: 10, y: 10, width: 60, height: 60 })) {
      expect(state.encode.mock.lastCall?.[2].crop[key]).toBeCloseTo(value)
    }
    expect(state.encode.mock.lastCall?.[2].aspectRatio).toBe('portrait')
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('preserves normal uploads on load/animation errors', async () => {
    state.load.mockRejectedValueOnce(new Error('Animated images are preserved.'))
    await click('Edit, crop')
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Animated')
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('disables apply on encode failure', async () => {
    state.encode.mockRejectedValueOnce(new Error('Encoding failed'))
    await click('Edit, crop')
    await preview()
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Encoding failed')
    await click('Apply WebP')
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('cannot apply before encoding finishes and discards a cancelled encoding', async () => {
    let resolve!: (value: unknown) => void
    state.encode.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await click('Edit, crop')
    await preview()
    await click('Apply WebP')
    expect(state.setValue).not.toHaveBeenCalled()
    await click('Cancel / keep')
    await act(async () => resolve({ file: new File(['webp'], 'dress.webp', { type: 'image/webp' }), width: 100, height: 100 }))
    expect(container.querySelector('fieldset')).toBeNull()
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('warns honestly when a WebP result is larger than the original', async () => {
    state.encode.mockResolvedValueOnce({ file: new File(['a larger encoded WebP file'], 'dress.webp', { type: 'image/webp' }), width: 1000, height: 1500 })
    await click('Edit, crop')
    await preview()
    expect(container.textContent).toContain('not smaller')
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('loads existing media only on demand, without saving it', async () => {
    state.value = undefined
    state.data = { url: 'https://media.example/dress.jpg', filename: 'dress.jpg', mimeType: 'image/jpeg' }
    const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['stored']) })
    vi.stubGlobal('fetch', fetcher)
    render()
    expect(fetcher).not.toHaveBeenCalled()
    await click('Edit, crop')
    await preview()
    expect(fetcher).toHaveBeenCalledWith(state.data.url, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('handles inaccessible existing R2 media without modifying anything', async () => {
    state.value = undefined
    state.data = { url: 'https://media.example/a.jpg', mimeType: 'image/jpeg' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render()
    await click('Edit, crop')
    expect(container.querySelector('[role=alert]')?.textContent).toContain('R2 CORS')
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('discards a stale decode when the user changes files', async () => {
    let resolve!: (value: unknown) => void
    state.load.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await click('Edit, crop')
    state.value = new File(['replacement'], 'other.jpg', { type: 'image/jpeg' })
    render()
    await act(async () => resolve({ naturalWidth: 100, naturalHeight: 100 }))
    await preview()
    expect(container.querySelector('fieldset')).toBeNull()
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it.each(['video/mp4', 'video/webm', 'image/gif', 'image/svg+xml'])('does not intercept %s uploads', type => {
    state.value = new File(['data'], 'media', { type })
    render()
    expect(container.querySelector('button')).toBeNull()
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('does not expose editing to read-only users or allow editing during save', () => {
    state.allowed = false
    render()
    expect(container.querySelector('button')).toBeNull()
    state.allowed = true
    state.processing = true
    render()
    expect(container.querySelector('button')?.disabled).toBe(true)
  })
})
