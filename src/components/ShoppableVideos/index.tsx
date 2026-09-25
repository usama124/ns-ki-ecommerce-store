'use client'

import { ShopByVideo, type Reel } from '@/components/home/ShopByVideo'
import React from 'react'

type Props = {
  reels?: Reel[]
}

export function ShoppableVideos({ reels = [] }: Props) {
  return <ShopByVideo reels={reels} />
}

export { ShopByVideo }
export type { Reel }
