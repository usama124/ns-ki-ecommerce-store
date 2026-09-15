import { describe, expect, it } from 'vitest'

function normalizeOrderNumber(input: string): string {
  const cleaned = input.trim().toUpperCase()
  if (cleaned.startsWith('#NKI-') || cleaned.startsWith('#LUJ-')) return cleaned
  if (cleaned.startsWith('NKI-') || cleaned.startsWith('LUJ-')) return `#${cleaned}`
  const digits = cleaned.replace(/[^0-9]/g, '')
  if (digits.length === 6) return `#NKI-${digits}`
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`
}

describe('Order Tracking Normalization', () => {
  it('normalizes raw digits into #NKI-XXXXXX format', () => {
    expect(normalizeOrderNumber('920182')).toBe('#NKI-920182')
  })

  it('preserves existing #NKI- prefix', () => {
    expect(normalizeOrderNumber('#NKI-920182')).toBe('#NKI-920182')
  })

  it('adds missing # to NKI- prefix', () => {
    expect(normalizeOrderNumber('NKI-920182')).toBe('#NKI-920182')
  })

  it('preserves legacy #LUJ- prefix for backward compatibility', () => {
    expect(normalizeOrderNumber('#LUJ-920182')).toBe('#LUJ-920182')
  })
})
