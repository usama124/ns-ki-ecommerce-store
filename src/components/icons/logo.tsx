import Image from 'next/image'

export function LogoIcon({
  className,
  width = 280,
  height = 80,
}: {
  className?: string
  width?: number
  height?: number
}) {
  return (
    <Image
      src="/logo.png"
      alt="N's KI Logo"
      width={width}
      height={height}
      className={className}
      priority
      unoptimized
    />
  )
}
