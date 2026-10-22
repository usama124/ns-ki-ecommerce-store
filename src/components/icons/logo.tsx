import Image from 'next/image'

export function LogoIcon({
  className,
  width = 280,
  height = 80,
  priority = false,
}: {
  className?: string
  width?: number
  height?: number
  priority?: boolean
}) {
  return (
    <Image
      src="/logo.png"
      alt="N's KI Logo"
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes="(min-width: 768px) 240px, 180px"
    />
  )
}
