import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '../helpers/checkoutDOM'
import { afterEach, describe, expect, it } from 'vitest'
import { LocationFields } from '@/components/checkout/LocationFields'
import { citiesForRegion, pakistanRegions, searchCities, validatePakistanLocation } from '@/utilities/pakistanLocations'
import { calculateShipping, MAJOR_CITIES } from '@/utilities/shipping'

afterEach(cleanup)
// This file uses createElement below because integration test filenames are .ts.
function LocationForm() {
  const [value, onChange] = useState({ province: 'Punjab', city: 'Lahore' })
  return React.createElement('form', null, React.createElement(LocationFields, { value, onChange }), React.createElement('output', null, JSON.stringify(value)))
}
describe('Pakistan location catalog and validation', () => {
  it('includes all seven regions and the reviewed local city/town catalog', () => {
    expect(pakistanRegions).toHaveLength(7)
    expect(pakistanRegions.reduce((count, region) => count + citiesForRegion(region).length, 0)).toBe(3027)
    for (const region of pakistanRegions) expect(new Set(citiesForRegion(region)).size).toBe(citiesForRegion(region).length)
    expect(citiesForRegion('__proto__')).toEqual([])
  })
  it.each([
    ['Punjab', 'Lahore'], ['Sindh', 'Karachi'], ['Khyber Pakhtunkhwa', 'Peshawar'],
    ['Balochistan', 'Quetta'], ['Islamabad Capital Territory', 'Islamabad'],
    ['Azad Kashmir', 'Muzaffarabad'], ['Gilgit-Baltistan', 'Gilgit'],
  ])('lists %s cities and accepts %s', (region, city) => {
    expect(citiesForRegion(region)).toContain(city)
    expect(validatePakistanLocation(region, city)).toBeNull()
  })
  it('searches case-insensitively within the selected region', () => {
    expect(searchCities('Sindh', '  karacHI ')).toContain('Karachi')
    expect(searchCities('Punjab', 'Karachi')).toEqual([])
    expect(searchCities('unknown', '')).toEqual([])
  })
  it('rejects mismatches but accepts normalized known cities and unlisted town names', () => {
    expect(validatePakistanLocation('Punjab', 'Karachi')).toContain('does not belong')
    expect(validatePakistanLocation('Punjab', ' lahore ')).toBeNull()
    expect(validatePakistanLocation('Punjab', 'QA unlisted village')).toBeNull()
    expect(validatePakistanLocation('Punjab', 'نیا گاؤں')).toBeNull()
  })
  it.each(['Other', '', ' ', 'a', 'x'.repeat(121), '<script>', 'town\nname', null, {}])('rejects invalid city %s', city => {
    expect(validatePakistanLocation('Punjab', city)).not.toBeNull()
  })
  it.each(['unknown', '__proto__', null, {}])('rejects invalid region %s', region => {
    expect(validatePakistanLocation(region, 'Lahore')).not.toBeNull()
  })
  it('leaves tariff classification separate from location coverage', () => {
    for (const city of MAJOR_CITIES) expect(calculateShipping(city, 1000)).toBe(250)
    expect(calculateShipping('QA unlisted village', 1000)).toBe(350)
    expect(calculateShipping('QA unlisted village', 15000)).toBe(0)
  })
})
describe('linked checkout fields', () => {
  it('clears stale city on region changes and only lists cities in the selected region', () => {
    render(React.createElement(LocationForm))
    fireEvent.change(screen.getByLabelText('Province / Region *'), { target: { value: 'Sindh' } })
    const select = screen.getByLabelText('City / Town *') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(Array.from(select.options).some(option => option.value === 'Lahore')).toBe(false)
    expect(Array.from(select.options).some(option => option.value === 'Karachi')).toBe(true)
    fireEvent.change(select, { target: { value: 'Karachi' } })
    expect(screen.getByRole('status').textContent).toContain('Karachi')
    fireEvent.change(screen.getByLabelText('Province / Region *'), { target: { value: 'Punjab' } })
    expect((screen.getByLabelText('City / Town *') as HTMLSelectElement).value).toBe('')
  })
  it('only renders province and city dropdowns without search or manual entry controls', () => {
    render(React.createElement(LocationForm))
    expect(document.querySelectorAll('select')).toHaveLength(2)
    expect(document.querySelectorAll('input, button')).toHaveLength(0)
    expect(screen.queryByLabelText('Find your city / town')).toBeNull()
    expect(screen.queryByLabelText('Your city / town *')).toBeNull()
  })
  it('disables city selection until a region has been chosen', () => {
    render(React.createElement(LocationForm))
    fireEvent.change(screen.getByLabelText('Province / Region *'), { target: { value: '' } })
    const city = screen.getByLabelText('City / Town *') as HTMLSelectElement
    expect(city.disabled).toBe(true)
    expect(city.value).toBe('')
    expect(city.options).toHaveLength(1)
  })
})
