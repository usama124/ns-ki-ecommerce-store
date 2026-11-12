import { describe, expect, it } from 'vitest'
import { calculateShipping, getShippingLabel } from '@/utilities/shipping'
import { SiteSettings } from '@/globals/SiteSettings'

describe('nationwide flat shipping', () => {
  it.each(['Lahore', 'Karachi', 'Gilgit', 'Muzaffarabad', 'Quetta', 'QA village'])('charges Rs.250 in %s regardless of order size by default', city => {
    for (const subtotal of [0, 1000, 15000, 50000]) expect(calculateShipping(city, subtotal)).toBe(250)
  })
  it('uses the same configured charge for every city and ignores old tier rates', () => {
    const settings = { flatShippingFee: 300, majorCityFee: 10, secondaryCityFee: 900, majorCities: [{ city: 'Lahore' }], freeShippingThreshold: 100 }
    for (const city of ['Lahore', 'Karachi', 'QA village']) expect(calculateShipping(city, 20000, settings)).toBe(300)
  })
  it('supports explicit zero shipping and old documents with missing new settings', () => {
    expect(calculateShipping('Lahore', 1000, { flatShippingFee: 0 })).toBe(0)
    expect(calculateShipping('QA village', 50000, { secondaryCityFee: 350, freeShippingThreshold: 15000 })).toBe(250)
    expect(calculateShipping('QA village', 50000, { flatShippingFee: null, freeShippingEnabled: null })).toBe(250)
    expect(getShippingLabel(0)).toBe('FREE')
  })
  it('only grants threshold free shipping when explicitly enabled by admin', () => {
    const settings = { flatShippingFee: 275, freeShippingEnabled: true, freeShippingThreshold: 10000 }
    expect(calculateShipping('Lahore', 9999, settings)).toBe(275)
    expect(calculateShipping('QA village', 10000, settings)).toBe(0)
    expect(calculateShipping('QA village', 10000, { ...settings, freeShippingEnabled: false })).toBe(275)
  })
  it('exposes flat pricing and explicit free-shipping controls while hiding obsolete city controls', () => {
    const group = SiteSettings.fields.find(f => 'name' in f && f.name === 'shipping')
    if (!group || !('fields' in group)) throw new Error('Missing shipping settings')
    const field = (name: string) => group.fields.find(f => 'name' in f && f.name === name)
    expect(field('flatShippingFee')).toMatchObject({ type: 'number', min: 0, defaultValue: 250 })
    expect(field('freeShippingEnabled')).toMatchObject({ type: 'checkbox', defaultValue: false })
    for (const name of ['majorCityFee', 'secondaryCityFee', 'majorCities']) expect(field(name)).toMatchObject({ admin: { hidden: true } })
  })
})
