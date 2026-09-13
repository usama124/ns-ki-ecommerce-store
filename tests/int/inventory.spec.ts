import { restoreOrderStock, validateAndDeductStock } from '@/utilities/inventory'
import { describe, expect, it, vi } from 'vitest'

describe('Inventory Management & Stock Automation', () => {
  it('deducts stock for in-stock variant items correctly', async () => {
    const mockProduct = {
      id: 'prod-1',
      title: 'Silk Formal Dress',
      variants: [
        { size: 'M', stock: 10, allowBackorder: false },
        { size: 'L', stock: 5, allowBackorder: false },
      ],
    }

    const mockPayload = {
      findByID: vi.fn().mockResolvedValue(mockProduct),
      update: vi.fn().mockResolvedValue({}),
    }

    const mockReq = {
      payload: mockPayload,
    } as any

    await validateAndDeductStock({
      items: [{ product: 'prod-1', variantSize: 'M', quantity: 2 }],
      req: mockReq,
    })

    expect(mockPayload.findByID).toHaveBeenCalledWith({
      collection: 'products',
      id: 'prod-1',
      depth: 0,
      req: mockReq,
      overrideAccess: true,
    })

    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'products',
      id: 'prod-1',
      data: {
        variants: [
          { size: 'M', stock: 8, allowBackorder: false },
          { size: 'L', stock: 5, allowBackorder: false },
        ],
      },
      req: mockReq,
      overrideAccess: true,
    })
  })

  it('throws an error when requested quantity exceeds available stock and allowBackorder is false', async () => {
    const mockProduct = {
      id: 'prod-1',
      title: 'Unstitched Lawn Suit',
      variants: [{ size: 'Unstitched', stock: 1, allowBackorder: false }],
    }

    const mockPayload = {
      findByID: vi.fn().mockResolvedValue(mockProduct),
      update: vi.fn(),
    }

    const mockReq = { payload: mockPayload } as any

    await expect(
      validateAndDeductStock({
        items: [{ product: 'prod-1', variantSize: 'Unstitched', quantity: 3 }],
        req: mockReq,
      }),
    ).rejects.toThrow(/Insufficient stock for "Silk Formal Dress"|Insufficient stock/)

    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('allows stock deduction when allowBackorder is true even if stock is 0', async () => {
    const mockProduct = {
      id: 'prod-2',
      title: 'Embroidered Pret',
      variants: [{ size: 'S', stock: 0, allowBackorder: true }],
    }

    const mockPayload = {
      findByID: vi.fn().mockResolvedValue(mockProduct),
      update: vi.fn().mockResolvedValue({}),
    }

    const mockReq = { payload: mockPayload } as any

    await validateAndDeductStock({
      items: [{ product: 'prod-2', variantSize: 'S', quantity: 2 }],
      req: mockReq,
    })

    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'products',
      id: 'prod-2',
      data: {
        variants: [{ size: 'S', stock: 0, allowBackorder: true }],
      },
      req: mockReq,
      overrideAccess: true,
    })
  })

  it('restores stock count correctly when order is cancelled', async () => {
    const mockProduct = {
      id: 'prod-1',
      title: 'Velvet Kaftan',
      variants: [{ size: 'L', stock: 3, allowBackorder: false }],
    }

    const mockPayload = {
      findByID: vi.fn().mockResolvedValue(mockProduct),
      update: vi.fn().mockResolvedValue({}),
    }

    const mockReq = { payload: mockPayload } as any

    await restoreOrderStock({
      items: [{ product: 'prod-1', variantSize: 'L', quantity: 4 }],
      req: mockReq,
    })

    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'products',
      id: 'prod-1',
      data: {
        variants: [{ size: 'L', stock: 7, allowBackorder: false }],
      },
      req: mockReq,
      overrideAccess: true,
    })
  })
})
