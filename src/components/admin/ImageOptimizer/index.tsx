'use client'

import { useDocumentInfo, useField, useForm, useUploadEdits } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import {
  encodeImage, formatImageBytes, FULL_CROP, loadEditableImage,
  fitAspectCrop, moveImageCrop, scaleImageCrop,
  type ImageCrop, type ImageSettings,
} from '@/utilities/adminImageOptimizer'
import './index.scss'
import { CropSelection } from './CropSelection'

type Source = { file: File; image: HTMLImageElement; url: string }
type Preview = Awaited<ReturnType<typeof encodeImage>> & { url: string; settings: ImageSettings }
const defaults = (): ImageSettings => ({ crop: { ...FULL_CROP }, maxWidth: 1600, maxHeight: 2400, quality: 85 })

/** UI-only field: uses Payload's existing file form state and storage handler. */
export function ImageOptimizer() {
  const { value, setValue, formProcessing } = useField<File | null>({ path: 'file' })
  const { data, hasSavePermission } = useDocumentInfo()
  const { setModified } = useForm()
  const { resetUploadEdits } = useUploadEdits()
  const [source, setSource] = useState<Source | null>(null)
  const [settings, setSettings] = useState<ImageSettings>(defaults)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [applied, setApplied] = useState('')
  const request = useRef<AbortController | null>(null)
  const latestFile = useRef(value)
  const latestURL = useRef(data?.url)
  useEffect(() => {
    latestFile.current = value
    latestURL.current = data?.url
    // Close an editor when the selected file is replaced/removed or a save completes.
    request.current?.abort()
    // Synchronize this local editor with Payload's independently managed form lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(null)
    setPreview(null)
    setError('')
    setLoading(false)
    setApplied('')
  }, [value, data?.url, data?.updatedAt])
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url) }, [source])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  useEffect(() => {
    if (!source) return
    let cancelled = false
    const timer = setTimeout(() => {
      setError('')
      void encodeImage(source.image, source.file.name, settings).then(result => {
        if (!cancelled) setPreview({ ...result, url: URL.createObjectURL(result.file), settings })
      }).catch((err: Error) => {
        if (!cancelled) { setPreview(null); setError(err.message) }
      })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [source, settings])

  const begin = async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setApplied('')
    try {
      let file = value instanceof File ? value : null
      if (!file && data?.url) {
        const response = await fetch(data.url, { signal: controller.signal })
        if (!response.ok) throw new Error('Unable to load the stored image. Check the media URL and R2 CORS settings, or select a local replacement.')
        file = new File([await response.blob()], data.filename || 'image', { type: data.mimeType })
      }
      if (!file) throw new Error('Select an image using the upload area first.')
      const image = await loadEditableImage(file)
      if (controller.signal.aborted) return
      setSettings(defaults())
      setSource({ file, image, url: URL.createObjectURL(file) })
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load image. The original is unchanged.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const cancel = () => {
    request.current?.abort()
    setSource(null)
    setPreview(null)
    setLoading(false)
    setError('')
  }
  const changeCrop = (key: keyof ImageCrop, next: number) => setSettings(current => {
    if (current.aspectRatio && Number.isFinite(next)) {
      const crop = key === 'x' || key === 'y'
        ? moveImageCrop(current.crop, key === 'x' ? next - current.crop.x : 0, key === 'y' ? next - current.crop.y : 0)
        : scaleImageCrop(current.crop, next / current.crop[key])
      return { ...current, crop }
    }
    return { ...current, crop: { ...current.crop, [key]: next } }
  })
  const preset = (ratio: number | null) => {
    if (!source) return
    const crop = ratio ? fitAspectCrop(source.image.naturalWidth, source.image.naturalHeight, ratio) : { ...FULL_CROP }
    setSettings(current => ({ ...current, crop, aspectRatio: ratio === 2 / 3 ? 'portrait' : ratio === 1 ? 'square' : null }))
  }
  const ready = preview && preview.settings === settings && !formProcessing
  const mimeType = value instanceof File ? value.type : value === null ? '' : data?.mimeType
  if (hasSavePermission === false || !mimeType?.startsWith('image/')) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return <p>GIF and SVG files retain their normal upload behavior; the WebP optimizer supports JPEG, PNG and static WebP.</p>
  }

  return <section className="admin-image-optimizer" aria-label="Image optimizer">
    <h3>Image optimizer</h3>
    <p>Crop and resize without stretching or enlarging. Preview WebP quality and file size before applying. Changes upload only when you save this media record.</p>
    {value instanceof File && !source && <p>Selected file: {value.name} · <strong>{formatImageBytes(value.size)}</strong></p>}
    {!source && <button type="button" disabled={loading || formProcessing} onClick={() => void begin()}>{loading ? 'Loading image…' : 'Edit, crop & compress image'}</button>}
    {loading && <button type="button" onClick={cancel}>Cancel</button>}
    {source && <>
      <CropSelection url={source.url} width={source.image.naturalWidth} height={source.image.naturalHeight}
        crop={settings.crop} disabled={formProcessing}
        onChange={crop => setSettings(current => ({ ...current, crop }))} />
      <p>Original: <strong>{formatImageBytes(source.file.size)}</strong> · {source.image.naturalWidth} × {source.image.naturalHeight} px</p>
      <fieldset disabled={formProcessing}>
        <legend>Crop</legend>
        <div className="admin-image-optimizer__actions">
          <button type="button" onClick={() => preset(null)}>Full image</button>
          <button type="button" aria-pressed={settings.aspectRatio === 'portrait'} onClick={() => preset(2 / 3)}>Product portrait (2:3)</button>
          <button type="button" aria-pressed={settings.aspectRatio === 'square'} onClick={() => preset(1)}>Square (1:1)</button>
        </div>
        <p>{settings.aspectRatio === 'portrait' ? '2:3 portrait locked. ' : settings.aspectRatio === 'square' ? '1:1 square locked. ' : ''}Drag inside the selection to position it over the model. Drag a corner inward to remove blank space. Only the selected area is kept.</p>
        <p>Keyboard: focus the crop and use arrow keys to move; + / − to resize. Numeric crop dimensions also keep the selected ratio locked.</p>
        <label>Crop area size (%)
          <input type="range" min={5} max={100} step={0.1}
            value={Math.min(100, settings.crop.width / (settings.aspectRatio ? fitAspectCrop(source.image.naturalWidth, source.image.naturalHeight, settings.aspectRatio === 'portrait' ? 2 / 3 : 1).width : 100) * 100)}
            onChange={event => {
              const base = settings.aspectRatio ? fitAspectCrop(source.image.naturalWidth, source.image.naturalHeight, settings.aspectRatio === 'portrait' ? 2 / 3 : 1).width : 100
              const percent = event.target.valueAsNumber
              setSettings(current => ({ ...current, crop: scaleImageCrop(current.crop, base * percent / 100 / current.crop.width) }))
            }} />
        </label>
        <div className="admin-image-optimizer__fields">
          {(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>Crop {key} (%)
            <input type="number" min={key === 'x' || key === 'y' ? 0 : 0.1} max={100} step="any" value={Number.isNaN(settings.crop[key]) ? '' : settings.crop[key]} onChange={event => changeCrop(key, event.target.valueAsNumber)} />
          </label>)}
        </div>
      </fieldset>
      <fieldset disabled={formProcessing}>
        <legend>Resize & WebP compression</legend>
        <div className="admin-image-optimizer__fields">
          {(['maxWidth', 'maxHeight'] as const).map(key => <label key={key}>{key === 'maxWidth' ? 'Maximum width (px)' : 'Maximum height (px)'}
            <input type="number" min={1} max={4096} value={Number.isNaN(settings[key]) ? '' : settings[key]} onChange={event => setSettings(current => ({ ...current, [key]: event.target.valueAsNumber }))} />
          </label>)}
          <label>WebP quality: {settings.quality}%
            <input type="range" min={1} max={100} value={settings.quality} onChange={event => setSettings(current => ({ ...current, quality: event.target.valueAsNumber }))} />
          </label>
        </div>
      </fieldset>
      <div aria-live="polite">
        {!ready && !error && <p>Generating size estimate…</p>}
        {ready && <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="admin-image-optimizer__preview" src={preview.url} alt="Compressed WebP preview" />
          <p>WebP upload: <strong>{formatImageBytes(preview.file.size)}</strong> · {preview.width} × {preview.height} px · {preview.file.size < source.file.size ? `${Math.round((1 - preview.file.size / source.file.size) * 100)}% smaller` : 'not smaller — reduce dimensions or quality, or keep the original'}</p>
          <p>This is the encoded upload size. Final stored size may vary after server processing; thumbnails use additional storage.</p>
        </>}
      </div>
      <div className="admin-image-optimizer__actions">
        <button type="button" disabled={!ready} onClick={() => {
          if (!ready || latestFile.current !== value || latestURL.current !== data?.url) return
          resetUploadEdits()
          setValue(preview.file)
          setModified(true)
          cancel()
          setApplied(`WebP prepared (${formatImageBytes(preview.file.size)}). Save this media record to upload it.`)
        }}>Apply WebP image</button>
        <button type="button" disabled={formProcessing} onClick={cancel}>Cancel / keep original</button>
      </div>
      <p>Applying this image replaces any pending edits made in Payload’s separate crop tool.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    {applied && <p role="status">{applied}</p>}
    {value instanceof File && value.type === 'image/webp' && !source && <p>Selected upload: {value.name} · {formatImageBytes(value.size)}</p>}
  </section>
}
