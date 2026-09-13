import { describe, expect, it } from 'vitest'

function normalizeOrderNumber(input: string): string {
  const cleaned = input.trim().toUpperCase()
  if (cleaned.startsWith('#LUJ-')) return cleaned
  if (cleaned.startsWith('LUJ-')) return `#${cleaned}`
  const digits = cleaned.replace(/[^0-9]/g, '')
  if (digits.length === 6) return `#LUJ-${digits}`
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`
}

describe('Order Tracking Normalization', () => {
  it('normalizes raw digits into #LUJ-XXXXXX format', () => {
    expect(normalizeOrderNumber('920182')).toBe('#LUJ-920182')
  })

  it('preserves existing #LUJ- prefix', () => {
    expect(normalizeOrderNumber('#LUJ-920182')).toBe('#LUJ-920182')
  })

  it('adds missing # to LUJ- prefix', () => {
    expect(normalizeOrderNumber('LUJ-920182')).toBe('#LUJ-920182')
  })
})
