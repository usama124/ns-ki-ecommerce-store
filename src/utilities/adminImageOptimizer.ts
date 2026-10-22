/** Browser-only processing. No upload happens until the normal Payload form is saved. */
export type ImageCrop = { x: number; y: number; width: number; height: number }
export type ImageSettings = { crop: ImageCrop; maxWidth: number; maxHeight: number; quality: number; aspectRatio?: 'portrait' | 'square' | null }
export const FULL_CROP: ImageCrop = { x: 0, y: 0, width: 100, height: 100 }
export const MAX_IMAGE_PIXELS = 40_000_000

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function fitAspectCrop(width: number, height: number, ratio: number): ImageCrop {
  const cropWidth = Math.min(100, 100 * ratio / (width / height))
  const cropHeight = Math.min(100, 100 * (width / height) / ratio)
  return { x: (100 - cropWidth) / 2, y: (100 - cropHeight) / 2, width: cropWidth, height: cropHeight }
}

export function moveImageCrop(crop: ImageCrop, dx: number, dy: number): ImageCrop {
  return { ...crop, x: clamp(crop.x + dx, 0, 100 - crop.width), y: clamp(crop.y + dy, 0, 100 - crop.height) }
}

/** Uniform scaling around the centre keeps the selected pixel aspect ratio. */
export function scaleImageCrop(crop: ImageCrop, scale: number): ImageCrop {
  const cx = crop.x + crop.width / 2
  const cy = crop.y + crop.height / 2
  const bounded = clamp(scale, Math.min(1, 1 / crop.width, 1 / crop.height), Math.min(2 * Math.min(cx, 100 - cx) / crop.width, 2 * Math.min(cy, 100 - cy) / crop.height))
  const width = crop.width * bounded
  const height = crop.height * bounded
  return { x: cx - width / 2, y: cy - height / 2, width, height }
}

export function resizeImageCrop(crop: ImageCrop, dx: number, dy: number, corner: string): ImageCrop {
  const left = corner.includes('w')
  const top = corner.includes('n')
  const anchorX = left ? crop.x + crop.width : crop.x
  const anchorY = top ? crop.y + crop.height : crop.y
  // Choose the dominant pointer axis; scale both dimensions together.
  const horizontal = (left ? -dx : dx) / crop.width
  const vertical = (top ? -dy : dy) / crop.height
  const desired = 1 + (Math.abs(horizontal) > Math.abs(vertical) ? horizontal : vertical)
  const max = Math.min((left ? anchorX : 100 - anchorX) / crop.width, (top ? anchorY : 100 - anchorY) / crop.height)
  const scale = clamp(desired, Math.min(1, 1 / crop.width, 1 / crop.height), max)
  const width = crop.width * scale
  const height = crop.height * scale
  return { x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height }
}

export function imageGeometry(width: number, height: number, settings: ImageSettings) {
  const { crop, maxWidth, maxHeight, quality } = settings
  if (![width, height, crop.x, crop.y, crop.width, crop.height, maxWidth, maxHeight, quality].every(Number.isFinite)
    || width <= 0 || height <= 0 || width * height > MAX_IMAGE_PIXELS
    || crop.x < -1e-8 || crop.y < -1e-8 || crop.width <= 0 || crop.height <= 0
    || crop.x + crop.width > 100 + 1e-8 || crop.y + crop.height > 100 + 1e-8
    || maxWidth < 1 || maxHeight < 1 || maxWidth > 4096 || maxHeight > 4096
    || quality < 1 || quality > 100) {
    throw new Error('Use a crop inside the image, dimensions from 1–4096, and quality from 1–100. Images must be under 40 megapixels.')
  }
  const sx = Math.max(0, Math.floor(width * crop.x / 100))
  const sy = Math.max(0, Math.floor(height * crop.y / 100))
  let sw = Math.max(1, Math.min(width - sx, Math.round(width * crop.width / 100)))
  let sh = Math.max(1, Math.min(height - sy, Math.round(height * crop.height / 100)))
  const unitWidth = settings.aspectRatio === 'portrait' ? 2 : 1
  const unitHeight = settings.aspectRatio === 'portrait' ? 3 : 1
  if (settings.aspectRatio) {
    const units = Math.floor(Math.min(sw / unitWidth, sh / unitHeight))
    if (units < 1) throw new Error('The selected area is too small for this aspect ratio.')
    sw = units * unitWidth
    sh = units * unitHeight
  }
  const scale = Math.min(1, maxWidth / sw, maxHeight / sh)
  if (settings.aspectRatio) {
    const units = Math.floor(Math.min(sw * scale / unitWidth, sh * scale / unitHeight))
    if (units < 1) throw new Error('Output dimensions are too small for this aspect ratio.')
    return { sx, sy, sw, sh, width: units * unitWidth, height: units * unitHeight }
  }
  return { sx, sy, sw, sh, width: Math.max(1, Math.floor(sw * scale)), height: Math.max(1, Math.floor(sh * scale)) }
}

export function formatImageBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

// Do not silently flatten GIFs, animated WebP/APNG, or rasterize SVGs.
export async function assertEditableImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('The optimizer supports JPEG, PNG and static WebP. Other formats and videos can still be uploaded normally.')
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (file.type === 'image/webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      if (['ANIM', 'ANMF'].includes(tag(offset))) throw new Error('Animated images are preserved. Upload this file normally without optimization.')
      const length = view.getUint32(offset + 4, true)
      offset += 8 + length + (length % 2)
    }
  }
  if (file.type === 'image/png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      if (tag(offset + 4) === 'acTL') throw new Error('Animated images are preserved. Upload this file normally without optimization.')
      offset += 12 + view.getUint32(offset)
    }
  }
}

export async function loadEditableImage(file: File): Promise<HTMLImageElement> {
  await assertEditableImage(file)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('This image could not be decoded. The original file has not been changed.'))
      image.src = url
    })
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) throw new Error('Choose an image under 40 megapixels.')
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function encodeImage(image: HTMLImageElement, name: string, settings: ImageSettings) {
  const geometry = imageGeometry(image.naturalWidth, image.naturalHeight, settings)
  const canvas = document.createElement('canvas')
  canvas.width = geometry.width
  canvas.height = geometry.height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image editing is not supported by this browser.')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, geometry.sx, geometry.sy, geometry.sw, geometry.sh, 0, 0, geometry.width, geometry.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Unable to encode this image. Try smaller dimensions.')), 'image/webp', settings.quality / 100)
    })
    if (blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP. Try a current Chrome, Edge, Firefox or Safari browser.')
    const file = new File([blob], `${name.replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: 'image/webp' })
    return { file, width: geometry.width, height: geometry.height }
  } finally {
    // Release the potentially large backing store, including on errors.
    canvas.width = 0
    canvas.height = 0
  }
}
