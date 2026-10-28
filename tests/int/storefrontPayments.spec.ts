// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), create: vi.fn(), findGlobal: vi.fn(), auth: vi.fn(), find: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: mocks.getPayload,
}))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: vi.fn() }))
vi.mock('@/utilities/commerceDatabase', () => ({
  commerceSession: vi.fn().mockResolvedValue({}),
  commerceTransaction: async (_payload: unknown, _user: unknown, work: (req: unknown) => unknown) => work({}),
  mongoCommerce: () => ({ db: { collection: () => ({ findOne: async () => null, insertOne: vi.fn(), updateOne: vi.fn() }) } }),
  COMMERCE: { checkout: 'test-checkout' },
}))
import { paymentDetails } from '../helpers/paymentSettings'
import { POST } from '@/app/api/orders/route'
import { validateOrderPaymentMethod } from '@/utilities/validateOrderPaymentMethod'
import {
  enabledPaymentMethods,
  getStorefrontPaymentNote,
  isStorefrontPaymentMethod,
  storefrontPaymentMethods,
} from '@/utilities/storefrontPayments'
const body = {
  customer: {
    name: 'QA',
    phone: '03001112222',
    address: 'Synthetic address',
    city: 'Lahore',
    province: 'Punjab',
  },
  items: [{ productId: 'product-1', variantSize: 'M', price: 1000, quantity: 1 }],
  subtotal: 1000,
  shippingFee: 250,
  codFee: 999,
  paymentProof: { transactionId: 'TEST1234' },
}
const settings = { paymentDetails, shipping: { codFee: 250, majorCityFee: 250, secondaryCityFee: 350, freeShippingThreshold: 15000, majorCities: [] } }
const headers = { 'Content-Type': 'application/json', Origin: 'https://store.example', 'Idempotency-Key': 'd380dd57-0d67-47ad-8273-e89de578ad59' }
const request = (method: unknown, proof: unknown = body.paymentProof, expectedTotal = method === 'cod' ? 1425 : 1250) =>
  new Request('https://store.example/api/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, expectedTotal, paymentMethod: method, paymentProof: proof }),
  })
const validate = (
  data: Record<string, unknown>,
  operation = 'create',
  originalDoc?: Record<string, unknown>,
) =>
  validateOrderPaymentMethod({
    data,
    operation,
    originalDoc,
    req: { payload: { findGlobal: mocks.findGlobal } },
  } as never)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPayload.mockResolvedValue({ ...mocks, config: { secret: 'synthetic-checkout-test-secret' } })
  mocks.auth.mockResolvedValue({ user: null })
  mocks.find.mockImplementation(({ collection }) => Promise.resolve({ docs: collection === 'sizes' ? [] : [{ id: 'product-1', title: 'QA', basePricePKR: 1000, variants: [{ size: { id: 'size-1', name: 'M' }, sku: 'QA', stock: 100 }] }] }))
  mocks.findGlobal.mockImplementation(({ slug }) => Promise.resolve(slug === 'site-settings' ? settings : { isActive: false }))
  mocks.create.mockResolvedValue({ id: 'order-1', orderNumber: '#QA-1' })
})
describe('disabled storefront payment methods', () => {
  it.each([
    ['Punjab', 'Karachi', 400],
    ['Sindh', 'Karachi', 200],
    ['Punjab', 'QA unlisted village', 200],
    ['unknown', 'Lahore', 400],
    ['Punjab', 'Other', 400],
  ])('validates region %s and city %s before order creation', async (province, city, status) => {
    const response = await POST(new Request('https://store.example/api/orders', {
      method: 'POST', headers,
      body: JSON.stringify({ ...body, expectedTotal: city === 'QA unlisted village' ? 1350 : 1250, customer: { ...body.customer, province, city }, paymentMethod: 'bank_transfer' }),
    }))
    expect(response.status).toBe(status)
    expect(mocks.create).toHaveBeenCalledTimes(status === 200 ? 1 : 0)
  })
  it.each(['cod', 'jazzcash', 'unknown', {}, ['bank_transfer']])(
    'rejects disabled/invalid %s before order writes',
    async (method) => {
      const response = await POST(request(method))
      expect(response.status).toBe(400)
      expect(mocks.create).not.toHaveBeenCalled()
    },
  )
  it.each(['bank_transfer', 'easypaisa'])(
    'keeps %s available, requires proof and never adds COD fees',
    async (method) => {
      expect((await POST(request(method, null))).status).toBe(400)
      expect(mocks.create).not.toHaveBeenCalled()
      const response = await POST(request(method))
      expect(response.status).toBe(200)
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: method,
            codFee: 0,
            totalAmount: 1250,
            paymentProof: body.paymentProof,
          }),
        }),
      )
    },
  )
  it.each(['cod', 'jazzcash'])(
    'blocks generic new orders and switching to disabled %s without breaking historical updates',
    async (method) => {
      await expect(async () => validate({ paymentMethod: method })).rejects.toThrow()
      await expect(async () =>
        validate({ paymentMethod: method }, 'update', { paymentMethod: 'bank_transfer' }),
      ).rejects.toThrow()
      expect(await validate({ status: 'shipped' }, 'update', { paymentMethod: method })).toEqual({
        status: 'shipped',
      })
      expect(
        await validate({ paymentMethod: method, status: 'cancelled' }, 'update', {
          paymentMethod: method,
        }),
      ).toEqual({ paymentMethod: method, status: 'cancelled' })
      expect(
        await validate({ paymentMethod: 'easypaisa' }, 'update', { paymentMethod: method }),
      ).toEqual({ paymentMethod: 'easypaisa' })
    },
  )
  it('keeps legacy defaults and generates footer text from current settings', () => {
    expect(isStorefrontPaymentMethod('bank_transfer')).toBe(true)
    expect(isStorefrontPaymentMethod('easypaisa')).toBe(true)
    expect(isStorefrontPaymentMethod('cod')).toBe(false)
    expect(isStorefrontPaymentMethod('jazzcash')).toBe(false)
    expect(getStorefrontPaymentNote()).toBe('We accept Bank / Raast Transfer · EasyPaisa')
    expect(
      getStorefrontPaymentNote({
        paymentMethods: { cod: true, bank_transfer: false, jazzcash: true, easypaisa: false },
      }),
    ).toBe('We accept Cash on Delivery · JazzCash')
  })
  it.each(Array.from({ length: 16 }, (_, mask) => mask))(
    'honors every combination of payment toggles: %i',
    (mask) => {
      const paymentMethods = Object.fromEntries(
        storefrontPaymentMethods.map((method, index) => [method, Boolean(mask & (1 << index))]),
      )
      expect(enabledPaymentMethods({ paymentMethods })).toEqual(
        storefrontPaymentMethods.filter((_, index) => Boolean(mask & (1 << index))),
      )
      if (mask === 0)
        expect(getStorefrontPaymentNote({ paymentMethods })).toContain('temporarily unavailable')
    },
  )
  it.each(['cod', 'jazzcash'])('admin can enable %s without a code change', async (method) => {
    mocks.findGlobal.mockResolvedValue({
      ...settings,
      paymentMethods: { cod: true, jazzcash: true },
      shipping: { ...settings.shipping, codFee: 175 },
    })
    expect((await POST(request(method, method === 'cod' ? null : body.paymentProof))).status).toBe(
      200,
    )
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: method,
          codFee: method === 'cod' ? 175 : 0,
          totalAmount: method === 'cod' ? 1425 : 1250,
        }),
      }),
    )
    expect(await validate({ paymentMethod: method })).toEqual({ paymentMethod: method })
    expect(mocks.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'site-settings',
        overrideAccess: false,
        req: expect.anything(),
      }),
    )
  })
  it.each(['bank_transfer', 'easypaisa'])(
    'admin can disable previously enabled %s',
    async (method) => {
      mocks.findGlobal.mockResolvedValue({
        ...settings,
        paymentMethods: { bank_transfer: false, easypaisa: false },
      })
      expect((await POST(request(method))).status).toBe(400)
      await expect(validate({ paymentMethod: method })).rejects.toThrow()
      expect(mocks.create).not.toHaveBeenCalled()
    },
  )
  it('fails closed if settings cannot be read and still permits unchanged legacy order updates', async () => {
    mocks.findGlobal.mockRejectedValue(new Error('private database detail'))
    const response = await POST(request('bank_transfer'))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private database detail')
    await expect(validate({ paymentMethod: 'bank_transfer' })).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: 'paymentMethod',
            message: expect.stringContaining('temporarily unavailable'),
          }),
        ]),
      },
    })
    expect(await validate({ status: 'shipped' }, 'update', { paymentMethod: 'cod' })).toEqual({
      status: 'shipped',
    })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each(storefrontPaymentMethods)('blocks %s when admin pauses all methods', async (method) => {
    mocks.findGlobal.mockResolvedValue({
      ...settings,
      paymentMethods: { cod: false, bank_transfer: false, jazzcash: false, easypaisa: false },
    })
    expect((await POST(request(method))).status).toBe(400)
    await expect(validate({ paymentMethod: method })).rejects.toThrow()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('respects a free COD fee and refuses invalid stored COD charges', async () => {
    mocks.findGlobal.mockResolvedValue({ ...settings, paymentMethods: { cod: true }, shipping: { ...settings.shipping, codFee: 0 } })
    expect((await POST(request('cod', null, 1250))).status).toBe(200)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ codFee: 0, totalAmount: 1250 }) }),
    )
    mocks.create.mockClear()
    mocks.findGlobal.mockResolvedValue({ ...settings, paymentMethods: { cod: true }, shipping: { ...settings.shipping, codFee: -1 } })
    expect((await POST(request('cod', null))).status).toBe(503)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
