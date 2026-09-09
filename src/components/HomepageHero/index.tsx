import React from 'react'
import { HeroSlider } from './HeroSlider'

type Props = {
  heroSlider?: any[]
}

export function HomepageHero({ heroSlider = [] }: Props) {
  return <HeroSlider slides={heroSlider} />
}
