import React, { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LocationFields } from '@/components/checkout/LocationFields'
import type { CodCoverage } from '@/utilities/codCoverage'
const coverage: CodCoverage = { cities: [{ name: 'LAHORE', label: 'Lahore', province: 'Punjab' }, { name: 'KARACHI', label: 'Karachi', province: 'Sindh' }], checkedAt: '2026-11-12T00:00:00Z' }
function Form({ restricted = true, data = coverage }: { restricted?: boolean; data?: CodCoverage | null }) {
  const [value, setValue] = useState({ province: 'Punjab', city: 'Lahore' })
  return React.createElement(LocationFields, { value, onChange: setValue, codCoverage: data, restrictToCod: restricted })
}
afterEach(cleanup)
describe('courier-supported checkout city selection', () => {
  it('shows only supported cities in the selected province and keeps exact provider values', () => {
    render(React.createElement(Form))
    const select = screen.getByLabelText('City / Town *') as HTMLSelectElement
    expect([...select.options].map(o => o.value)).toEqual(['', 'LAHORE'])
    expect(select.value).toBe('LAHORE')
    expect(screen.queryByRole('option', { name: 'Karachi' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Province / Region *'), { target: { value: 'Sindh' } })
    expect([...select.options].map(o => o.value)).toEqual(['', 'KARACHI'])
    expect(select.value).toBe('')
  })
  it('does not fall back to the large address catalog when COD coverage is unavailable', () => {
    render(React.createElement(Form, { data: null }))
    const select = screen.getByLabelText('City / Town *') as HTMLSelectElement
    expect(select.disabled).toBe(true)
    expect(select.options).toHaveLength(1)
    expect(screen.getByText(/temporarily unavailable/)).toBeTruthy()
  })
  it('clearly handles a province with no mapped courier destinations', () => {
    render(React.createElement(Form))
    fireEvent.change(screen.getByLabelText('Province / Region *'), { target: { value: 'Balochistan' } })
    expect((screen.getByLabelText('City / Town *') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText(/No verified InstaWorld/)).toBeTruthy()
  })
  it('retains the existing location list for non-COD checkout', () => {
    render(React.createElement(Form, { restricted: false }))
    expect((screen.getByLabelText('City / Town *') as HTMLSelectElement).options.length).toBeGreaterThan(100)
  })
})
