// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
import { POST } from '@/app/api/inventory/validate-cart/route'

function request(items: unknown[]) {
  return new Request('http://localhost/api/inventory/validate-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getPayload.mockResolvedValue({ find: mocks.find })
})

describe('Batched live cart validation', () => {
  it('reads multiple cart lines in one query and returns live stock adjustments', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        { id: 'a', title: 'Product A', variants: [{ size: { name: 'M' }, stock: 1 }] },
        { id: 'b', title: 'Product B', variants: [{ size: { name: 'S' }, stock: 5 }] },
      ],
    })
    const response = await POST(
      request([
        { productId: 'a', variantSize: 'M', quantity: 2 },
        { productId: 'b', variantSize: 'S', quantity: 1 },
      ]),
    )
    expect(mocks.find).toHaveBeenCalledTimes(1)
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 1, overrideAccess: false }),
    )
    expect(await response.json()).toMatchObject({
      valid: false,
      adjustments: [{ productId: 'a', availableStock: 1 }],
    })
  })

  it('rejects missing products instead of treating them as available', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    const response = await POST(request([{ productId: 'missing', variantSize: 'S', quantity: 1 }]))
    expect(await response.json()).toMatchObject({
      valid: false,
      adjustments: [{ outOfStock: true }],
    })
  })

  it('fails closed when the database is unavailable', async () => {
    mocks.find.mockRejectedValue(new Error('Database unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await POST(request([{ productId: 'a', variantSize: 'S', quantity: 1 }]))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ valid: false })
    log.mockRestore()
  })

  it('bounds query size and rejects invalid quantities before connecting', async () => {
    const response = await POST(request([{ productId: 'a', quantity: -1 }]))
    expect(response.status).toBe(400)
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })
})
