import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstaWorldBooking } from '@/components/admin/InstaWorldBooking'
const props = { orderId: '1', status: 'processing', paymentMethod: 'cod', city: 'Lahore', itemLabels: ['QA-M × 2'] }
const response = (data: unknown) => new Response(JSON.stringify(data))
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/references')) return response({ locations: [{ id: 812, name: 'Warehouse', city: 'LAHORE' }], cities: ['LAHORE'] })
    if (options?.method === 'POST') return response({ configured: true, bookingState: 'booked', tracking: { trackingNumber: 'IW123', status: 'BOOKED', checkedAt: '2026-11-11T00:00:00Z', events: [] } })
    return response({ configured: true, bookingState: null, tracking: null })
  }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('manual InstaWorld admin booking panel', () => {
  it.each([{ status: 'confirmed' }, { paymentMethod: 'bank_transfer' }])('does not offer booking for ineligible order %j', async change => {
    render(React.createElement(InstaWorldBooking, { ...props, ...change }))
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'Book with InstaWorld' })).toBeNull()
  })
  it('requires reference loading, item weights and real-shipment confirmation before booking', async () => {
    render(React.createElement(InstaWorldBooking, props))
    const load = await screen.findByRole('button', { name: /Load pickup/ })
    fireEvent.click(load)
    const weight = await screen.findByLabelText('Item 1 weight kg')
    const book = screen.getByRole('button', { name: 'Book with InstaWorld' }) as HTMLButtonElement
    expect(book.disabled).toBe(true)
    fireEvent.change(weight, { target: { value: '0.5' } })
    expect(book.disabled).toBe(false)
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    fireEvent.click(book)
    expect(vi.mocked(fetch).mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
    fireEvent.click(book)
    expect(await screen.findByText('IW123')).toBeTruthy()
    const options = vi.mocked(fetch).mock.calls.find(([, o]) => o?.method === 'POST')![1]!
    expect(JSON.parse(options.body as string)).toMatchObject({ action: 'book', confirm: true, locationId: 812, city: 'LAHORE', weightsKg: [0.5] })
    expect(screen.getByRole('button', { name: 'Refresh shipping status' })).toBeTruthy()
  })
  it('explains missing environment configuration without sending a booking', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ configured: false, bookingState: null, tracking: null }))
    render(React.createElement(InstaWorldBooking, props))
    expect(await screen.findByText(/INSTAWORLD_API_KEY/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Book with InstaWorld' })).toBeNull()
  })
})
