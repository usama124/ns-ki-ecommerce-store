import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({ toast: mock }))
vi.mock('@/components/orders/PrivateReceipt', () => ({ PrivateReceipt: () => null }))
vi.mock('@/components/admin/CommerceOutbox', () => ({ CommerceOutbox: () => null }))
import { OrdersDashboardClient } from '@/components/admin/OrdersDashboardView/OrdersDashboardClient'

const order = { id: 'order-1', orderNumber: '#NKI-123456', status: 'cancelled', paymentMethod: 'cod', customer: { name: 'Test', phone: '03001234567', city: 'Lahore', province: 'Punjab', address: 'Test address' }, items: [], totalAmount: 1000, createdAt: '2026-10-28T00:00:00Z' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let orders = [order]
beforeEach(() => {
  vi.resetAllMocks()
  orders = [order]
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/admin/orders/delete') { orders = []; return response({ success: true, deletedId: order.id }) }
    return response({ orders, pagination: { totalPages: 1, totalDocs: orders.length } })
  }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function openOrder() {
  render(React.createElement(OrdersDashboardClient))
  fireEvent.click(await screen.findByRole('button', { name: /Details/ }))
  return screen.getByRole('button', { name: 'Delete order permanently' })
}
describe('dashboard delete order action', () => {
  it('requires confirmation, deletes the selected order, closes details and refreshes the list', async () => {
    fireEvent.click(await openOrder())
    await waitFor(() => expect(mock.success).toHaveBeenCalledWith('Order #NKI-123456 deleted'))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('#NKI-123456'))
    expect(fetch).toHaveBeenCalledWith('/api/admin/orders/delete', expect.objectContaining({ method: 'POST', body: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }) }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete order permanently' })).toBeNull())
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith('/api/admin/orders?'))).toHaveLength(2)
  })
  it('does not delete when confirmation is dismissed', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    fireEvent.click(await openOrder())
    expect(vi.mocked(fetch).mock.calls.some(([url]) => url === '/api/admin/orders/delete')).toBe(false)
  })
  it('disables deletion until cancellation', async () => {
    orders = [{ ...order, status: 'confirmed' }]
    const button = await openOrder()
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(window.confirm).not.toHaveBeenCalled()
  })
  it('keeps the order visible and displays the server refusal on financial guard failure', async () => {
    const button = await openOrder()
    vi.mocked(fetch).mockResolvedValueOnce(response({ error: 'Orders with recorded money cannot be deleted.' }, 409))
    fireEvent.click(button)
    await waitFor(() => expect(mock.error).toHaveBeenCalledWith('Orders with recorded money cannot be deleted.'))
    expect(screen.getByRole('button', { name: 'Delete order permanently' })).toBeTruthy()
    expect(mock.success).not.toHaveBeenCalled()
  })
})
