/** Browser-only processing. No upload happens until the normal Payload form is saved. */
export type ImageCrop = { x: number; y: number; width: number; height: number }
export type ImageSettings = { crop: ImageCrop; maxWidth: number; maxHeight: number; quality: number }
export const FULL_CROP: ImageCrop = { x: 0, y: 0, width: 100, height: 100 }
export const MAX_IMAGE_PIXELS = 40_000_000

export function imageGeometry(width: number, height: number, settings: ImageSettings) {
  const { crop, maxWidth, maxHeight, quality } = settings
  if (![width, height, crop.x, crop.y, crop.width, crop.height, maxWidth, maxHeight, quality].every(Number.isFinite)
    || width <= 0 || height <= 0 || width * height > MAX_IMAGE_PIXELS
    || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0
    || crop.x + crop.width > 100 || crop.y + crop.height > 100
    || maxWidth < 1 || maxHeight < 1 || maxWidth > 4096 || maxHeight > 4096
    || quality < 1 || quality > 100) {
    throw new Error('Use a crop inside the image, dimensions from 1–4096, and quality from 1–100. Images must be under 40 megapixels.')
  }
  const sx = Math.floor(width * crop.x / 100)
  const sy = Math.floor(height * crop.y / 100)
  const sw = Math.max(1, Math.min(width - sx, Math.round(width * crop.width / 100)))
  const sh = Math.max(1, Math.min(height - sy, Math.round(height * crop.height / 100)))
  const scale = Math.min(1, maxWidth / sw, maxHeight / sh)
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
