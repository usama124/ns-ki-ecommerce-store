import NextImage, { type ImageProps } from 'next/image'
import { responsiveMedia, type MediaVariant } from '@/utilities/responsiveMedia'

type Props = Pick<ImageProps, 'alt' | 'className' | 'fill' | 'sizes' | 'width' | 'height' | 'priority' | 'onLoad' | 'onClick' | 'style' | 'loading'> & {
  media: unknown
  variant?: MediaVariant
}

/** R2 derivatives are already encoded: let the browser select them without re-encoding. */
export function ResponsiveImage({ media, variant = 'card', alt, className, fill, sizes = '100vw', width, height, priority, onLoad, onClick, style, loading }: Props) {
  const image = responsiveMedia(media, variant)
  if (!image.src) return null
  if (!image.srcSet) {
    return <NextImage src={image.src} alt={alt} className={className} fill={fill} sizes={sizes}
      width={fill ? undefined : width} height={fill ? undefined : height} priority={priority}
      loading={priority ? undefined : loading} onLoad={onLoad} onClick={onClick} style={style} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.src} srcSet={image.srcSet} sizes={sizes} alt={alt} className={className}
    width={fill ? undefined : width} height={fill ? undefined : height}
    loading={priority ? 'eager' : loading || 'lazy'} fetchPriority={priority ? 'high' : undefined}
    decoding="async" onLoad={onLoad} onClick={onClick}
    style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style} />
}
