import { useEffect, useState } from 'react'

export type ScrollDirection = 'up' | 'down'

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('up')
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0

    const updateScrollDirection = () => {
      const currentScrollY = window.scrollY
      const difference = currentScrollY - lastScrollY

      // Ignore minor scroll jitter (< 5px)
      if (Math.abs(difference) > 5) {
        const direction: ScrollDirection = difference > 0 ? 'down' : 'up'
        setScrollDirection(direction)
      }

      setScrollY(currentScrollY)
      lastScrollY = currentScrollY > 0 ? currentScrollY : 0
    }

    window.addEventListener('scroll', updateScrollDirection, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollDirection)
  }, [])

  // Header is visible if scroll position is <= 50px or if user is scrolling UP
  const isVisible = scrollY <= 50 || scrollDirection === 'up'

  return {
    scrollDirection,
    scrollY,
    isVisible,
  }
}

