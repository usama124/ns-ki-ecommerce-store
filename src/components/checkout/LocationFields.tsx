'use client'

import React from 'react'
import { citiesForRegion, pakistanRegions } from '@/utilities/pakistanLocations'

type Location = { province: string; city: string }
const control =
  'w-full px-3 py-2.5 text-sm border border-border focus:border-[#648698] focus:outline-hidden bg-background text-foreground rounded-lg'
const label = 'block text-[11px] uppercase tracking-widest font-semibold text-foreground mb-1'

export function LocationFields({
  value,
  onChange,
}: {
  value: Location
  onChange: (location: Location) => void
}) {
  const cities = citiesForRegion(value.province)
  return (
    <>
      <div>
        <label className={label} htmlFor="checkout-province">
          Province / Region *
        </label>
        <select
          id="checkout-province"
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
          className={control}
          required
          disabled={!value.province}
          value={value.city}
          onChange={(event) => onChange({ province: value.province, city: event.target.value })}
        >
          <option value="">Select city / town</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
