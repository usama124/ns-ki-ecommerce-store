'use client'

import React from 'react'
import { citiesForRegion, pakistanRegions } from '@/utilities/pakistanLocations'
import { cityKey, type CodCoverage } from '@/utilities/codCoverage'

type Location = { province: string; city: string }
const control =
  'w-full px-3 py-2.5 text-sm border border-border focus:border-[#648698] focus:outline-hidden bg-background text-foreground rounded-lg'
const label = 'block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1'

export function LocationFields({
  value,
  onChange,
  codCoverage,
  restrictToCod = false,
}: {
  value: Location
  onChange: (location: Location) => void
  codCoverage?: CodCoverage | null
  restrictToCod?: boolean
}) {
  const cities = restrictToCod
    ? (codCoverage?.cities || []).filter(city => city.province === value.province).map(city => ({ name: city.name, label: city.label }))
    : citiesForRegion(value.province).map(name => ({ name, label: name }))
  const selected = cities.find(city => cityKey(city.name) === cityKey(value.city))?.name || ''
  return (
    <>
      <div>
        <label className={label} htmlFor="checkout-province">
          Province / Region *
        </label>
        <select
          id="checkout-province"
          autoComplete="address-level1"
          required
          className={control}
          value={value.province}
          onChange={(event) => {
            onChange({ province: event.target.value, city: '' })
          }}
        >
          <option value="">Select province / region</option>
          {pakistanRegions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="checkout-city">
          City / Town *
        </label>
        <select
          id="checkout-city"
          autoComplete="address-level2"
          className={control}
          required
          disabled={!value.province || (restrictToCod && cities.length === 0)}
          value={selected}
          onChange={(event) => onChange({ province: value.province, city: event.target.value })}
        >
          <option value="">Select city / town</option>
          {cities.map((city) => (
            <option key={city.name} value={city.name}>
              {city.label}
            </option>
          ))}
        </select>
        {restrictToCod && <p className="mt-2 text-xs text-foreground">{!codCoverage ? 'COD delivery cities are temporarily unavailable. Choose another payment method or refresh checkout.' : cities.length ? 'Only InstaWorld-supported COD destinations are shown.' : 'No verified InstaWorld COD destinations are available in this province / region.'}</p>}
      </div>
    </>
  )
}
