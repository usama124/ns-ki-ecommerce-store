export type MediaVariant = 'thumbnail' | 'card' | 'hero' | 'original'
type Candidate = { url: string; width: number }
const isURL = (value: unknown): value is string => typeof value === 'string' && /^(https?:\/\/|\/(?!\/))/.test(value)
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}

/** Use stored URLs and actual widths only; never invent filenames for legacy media. */
export function responsiveMedia(media: unknown, variant: MediaVariant = 'card') {
  const source = record(media)
  const sizes = record(source.sizes)
  const order = variant === 'original' ? ['original', 'hero', 'card', 'thumbnail']
    : variant === 'thumbnail' ? ['thumbnail', 'card', 'hero', 'original']
    : variant === 'hero' ? ['hero', 'original', 'card', 'thumbnail'] : ['card', 'hero', 'original', 'thumbnail']
  const urls: Record<string, unknown> = { original: typeof media === 'string' ? media : source.url }
  for (const name of ['thumbnail', 'card', 'hero']) urls[name] = record(sizes[name]).url
  const src = order.map(name => urls[name]).find(isURL)
  if (!src) return { src: undefined, srcSet: undefined }
  // Preserve vector/animated GIF originals rather than selecting raster derivatives.
  if (source.mimeType === 'image/gif' || source.mimeType === 'image/svg+xml') {
    return { src: isURL(source.url) ? source.url : src, srcSet: undefined }
  }
  const candidates = new Map<number, Candidate>()
  for (const item of [source, record(sizes.thumbnail), record(sizes.card), record(sizes.hero)]) {
    if (isURL(item.url) && typeof item.width === 'number' && Number.isFinite(item.width) && item.width > 0) {
      candidates.set(item.width, { url: item.url, width: item.width })
    }
  }
  // The original is deliberately retained alone for lightbox/detail inspection.
  const srcSet = variant !== 'original' && candidates.size > 1
    ? [...candidates.values()].sort((a, b) => a.width - b.width)
      .map(item => `${item.url.replace(/ /g, '%20').replace(/,/g, '%2C')} ${item.width}w`).join(', ')
    : undefined
  return { src, srcSet }
}
