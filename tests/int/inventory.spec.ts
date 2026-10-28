import { restoreOrderStock, validateAndDeductStock } from '@/utilities/inventory'
import { describe, expect, it, vi } from 'vitest'

describe('Inventory Management & Stock Automation', () => {
  it('rejects an unmatched size instead of creating an order without deducting stock', async () => {
    const payload = { findByID: vi.fn().mockResolvedValue({ title: 'Suit', status: 'published', variants: [{ size: 'M', stock: 10 }] }), update: vi.fn() }
    await expect(validateAndDeductStock({ items: [{ product: 'p1', variantSize: 'forged', quantity: 1 }], req: { payload } as any })).rejects.toThrow('size is unavailable')
    expect(payload.update).not.toHaveBeenCalled()
  })
  it('rejects a draft product even if its variant has stock', async () => {
    const payload = { findByID: vi.fn().mockResolvedValue({ title: 'Suit', status: 'draft', variants: [{ size: 'M', stock: 10 }] }), update: vi.fn() }
    await expect(validateAndDeductStock({ items: [{ product: 'p1', variantSize: 'M', quantity: 1 }], req: { payload } as any })).rejects.toThrow('product is unavailable')
    expect(payload.update).not.toHaveBeenCalled()
  })
  it('rejects fractional quantities before any product mutation', async () => {
    const payload = { findByID: vi.fn(), update: vi.fn() }
    await expect(validateAndDeductStock({ items: [{ product: 'p1', variantSize: 'M', quantity: 1.5 }], req: { payload } as any })).rejects.toThrow('Invalid order item')
    expect(payload.findByID).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
  it('deducts stock for in-stock variant items correctly', async () => {
    const mockProduct = {
      id: 'prod-1',
      title: 'Silk Formal Dress',
      status: 'published',
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
      context: {
        skipShoppableVideoSync: true,
      },
    })
  })

  it('throws an error when requested quantity exceeds available stock and allowBackorder is false', async () => {
    const mockProduct = {
      id: 'prod-1',
      title: 'Unstitched Lawn Suit',
      status: 'published',
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
    ).rejects.toThrow(/Inventory constraint failed|Insufficient stock/)

    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('allows stock deduction when allowBackorder is true even if stock is 0', async () => {
    const mockProduct = {
      id: 'prod-2',
      title: 'Embroidered Pret',
      status: 'published',
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
      context: {
        skipShoppableVideoSync: true,
      },
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
      context: {
        skipShoppableVideoSync: true,
      },
    })
  })
})
