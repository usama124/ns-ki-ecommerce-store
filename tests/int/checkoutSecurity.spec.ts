// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getPayload: vi.fn(),
  auth: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  findGlobal: vi.fn(),
  create: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@/utilities/requestLimits', () => ({ enforceRequestLimit: vi.fn() }))
vi.mock('@/utilities/checkoutEmailDelivery', () => ({ sendCheckoutEmails: vi.fn() }))
vi.mock('@/utilities/commerceDatabase', () => ({
  commerceSession: vi.fn().mockResolvedValue({}),
  commerceTransaction: async (_payload: unknown, _user: unknown, work: (req: unknown) => unknown) => work({}),
  mongoCommerce: () => ({ db: { collection: () => ({ findOne: async () => null, insertOne: vi.fn(), updateOne: vi.fn() }) } }),
  COMMERCE: { checkout: 'test-checkout' },
}))
import { POST } from '@/app/api/orders/route'
import { GET as track } from '@/app/api/orders/track/route'
import { parseCheckout, quoteCheckout } from '@/utilities/checkoutQuote'
import { verifyOrderAccess } from '@/utilities/orderAccess'
import type { Payload } from 'payload'

const customer = {
  name: 'Test Customer',
  phone: '03001234567',
  email: 'TEST@EXAMPLE.COM',
  city: 'Lahore',
  province: 'Punjab',
  address: '123 Test Street',
}
const base = () => ({
  customer: { ...customer },
  paymentMethod: 'cod',
  items: [{ productId: 'p1', variantSize: 'M', quantity: 2, price: 1 }],
  subtotal: 2,
  shippingFee: -100,
  codFee: -100,
  totalAmount: -198,
})
const settings = {
  paymentMethods: { cod: true, jazzcash: true },
  shipping: {
    freeShippingThreshold: 15000,
    majorCityFee: 250,
    secondaryCityFee: 350,
    codFee: 100,
    majorCities: [],
  },
}
const product = () => ({
  id: 'p1',
  title: 'Suit',
  basePricePKR: 3500,
  primaryCategory: 'c1',
  categories: ['c1'],
  variants: [{ size: { id: 's1', name: 'M' }, sku: 'TRUSTED-SKU', stock: 10, pricePKR: 4000 }],
})
const request = (body: unknown, origin = 'https://store.example') =>
  new Request('https://store.example/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': 'd380dd57-0d67-47ad-8273-e89de578ad59' },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.resetAllMocks()
  mock.getPayload.mockResolvedValue({ ...mock, config: { secret: 'isolated-unit-test-secret' } })
  mock.find.mockResolvedValue({ docs: [product()] })
  mock.findGlobal.mockImplementation(({ slug }) =>
    Promise.resolve(slug === 'site-settings' ? settings : { isActive: false }),
  )
  mock.auth.mockResolvedValue({ user: null })
  mock.create.mockResolvedValue({ id: 'order1', orderNumber: '#NKI-123456' })
})
describe('Authoritative checkout quotes', () => {
  it.each(['nski-preview.vercel.app', 'nski-git-develop-team.vercel.app'])('accepts a valid checkout on assigned preview hostname %s despite a different canonical URL', async hostname => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://www.siblingsbynski.com')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_URL', 'nski-preview.vercel.app')
    vi.stubEnv('VERCEL_BRANCH_URL', 'nski-git-develop-team.vercel.app')
    try {
      const result = await POST(request({ ...base(), expectedTotal: 8350 }, `https://${hostname}`))
      expect(result.status).toBe(200)
      expect(mock.create).toHaveBeenCalledOnce()
    } finally { vi.unstubAllEnvs() }
  })
  it('ignores forged prices, fees, status, notes and account identity', async () => {
    const result = await POST(
      request({
        ...base(),
        expectedTotal: 8350,
        status: 'delivered',
        customerAccount: 'someone-else',
        notes: 'forged',
      }),
    )
    expect(result.status).toBe(200)
    const [options] = mock.create.mock.calls[0]
    expect(options.data).toMatchObject({
      subtotal: 8000,
      shippingFee: 250,
      codFee: 100,
      totalAmount: 8350,
      status: 'confirmed',
      customer: { email: 'test@example.com' },
      items: [{ unitPrice: 4000, variantSku: 'TRUSTED-SKU' }],
    })
    expect(options.data.customerAccount).toBeUndefined()
    expect(options.data.notes).toBeUndefined()
    const response = await result.json()
    expect(verifyOrderAccess('order1', response.accessToken, 'isolated-unit-test-secret')).toBe(
      true,
    )
    expect(result.headers.get('cache-control')).toBe('private, no-store')
  })
  it('requires explicit review when current prices do not match the confirmed total', async () => {
    const result = await POST(request({ ...base(), expectedTotal: 1 }))
    expect(result.status).toBe(409)
    expect(await result.json()).toMatchObject({
      code: 'QUOTE_CHANGED',
      quote: { totalAmount: 8350, items: [{ unitPrice: 4000 }] },
    })
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('assigns only the authenticated customer account', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'real-customer', roles: ['customer'] } })
    await POST(request({ ...base(), expectedTotal: 8350, customerAccount: 'forged' }))
    expect(mock.create.mock.calls[0][0].data.customerAccount).toBe('real-customer')
  })
  it('uses active sale prices, server variant prices and configured shipping', async () => {
    mock.findGlobal.mockImplementation(({ slug }) =>
      Promise.resolve(
        slug === 'site-settings'
          ? { ...settings, shipping: { ...settings.shipping, majorCityFee: 75, codFee: 0 } }
          : { isActive: true, discountPercentage: 25, targetedCategories: ['c1'] },
      ),
    )
    const result = await quoteCheckout(mock as unknown as Payload, parseCheckout(base()))
    expect(result).toMatchObject({ subtotal: 6000, shippingFee: 75, codFee: 0, totalAmount: 6075 })
  })
  it('does not discount expired campaigns and honors a zero variant override', async () => {
    const item = product()
    item.variants[0].pricePKR = 0
    mock.find.mockResolvedValue({ docs: [item] })
    mock.findGlobal.mockImplementation(({ slug }) =>
      Promise.resolve(
        slug === 'site-settings'
          ? settings
          : {
              isActive: true,
              endDate: '2000-01-01',
              discountPercentage: 99,
              targetedCategories: ['c1'],
            },
      ),
    )
    const result = await quoteCheckout(mock as unknown as Payload, parseCheckout(base()))
    expect(result.subtotal).toBe(0)
  })
  it('merges repeated variant lines before checking stock', async () => {
    const input = base()
    input.items = [input.items[0], { ...input.items[0], variantSize: 'm', quantity: 9 }]
    const result = await POST(request({ ...input, expectedTotal: 0 }))
    expect(result.status).toBe(409)
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('rejects missing/draft products, unmatched/ambiguous variants and insufficient stock', async () => {
    for (const docs of [
      [],
      [{ ...product(), variants: [] }],
      [{ ...product(), variants: [product().variants[0], product().variants[0]] }],
      [{ ...product(), variants: [{ ...product().variants[0], stock: 1 }] }],
    ]) {
      mock.find.mockResolvedValue({ docs })
      expect((await POST(request({ ...base(), expectedTotal: 0 }))).status).toBe(409)
    }
    expect(mock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: false,
        where: expect.objectContaining({
          and: expect.arrayContaining([{ status: { equals: 'published' } }]),
        }),
      }),
    )
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('fails closed if pricing configuration or database access fails', async () => {
    mock.findGlobal.mockRejectedValue(new Error('private credentials must not leak'))
    const result = await POST(request({ ...base(), expectedTotal: 8350 }))
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('credentials')
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('does not let cross-origin requests invoke checkout', async () => {
    expect((await POST(request(base(), 'https://attacker.example'))).status).toBe(403)
    expect(mock.getPayload).not.toHaveBeenCalled()
  })
  it('rejects screenshots rather than writing new receipts into public media', async () => {
    const result = await POST(
      request({
        ...base(),
        paymentMethod: 'bank_transfer',
        paymentProof: { transactionId: 'ABC123', screenshot: 'public-media-id' },
      }),
    )
    expect(result.status).toBe(400)
    expect(mock.getPayload).not.toHaveBeenCalled()
  })
  it('accepts reference-only digital payments but always keeps them pending verification', async () => {
    mock.findGlobal.mockImplementation(({ slug }) =>
      Promise.resolve(
        slug === 'site-settings'
          ? {
              ...settings,
              paymentDetails: {
                jazzcash: { accountName: 'Merchant', mobileNumber: '03001112222' },
              },
            }
          : { isActive: false },
      ),
    )
    const result = await POST(
      request({
        ...base(),
        expectedTotal: 8250,
        paymentMethod: 'jazzcash',
        paymentProof: { transactionId: 'ABC-123' },
        status: 'delivered',
      }),
    )
    expect(result.status).toBe(200)
    expect(mock.create.mock.calls[0][0].data).toMatchObject({
      paymentProof: { transactionId: 'ABC123' },
      status: 'pending_verification',
    })
  })
  it('validates input before database calls', async () => {
    for (const quantity of [-1, 0, 1.5, 100, '2']) {
      const input = base()
      expect(
        (await POST(request({ ...input, items: [{ ...input.items[0], quantity }] }))).status,
      ).toBe(400)
    }
    expect(
      (await POST(request({ ...base(), items: Array(51).fill(base().items[0]) }))).status,
    ).toBe(400)
    expect(
      (await POST(request({ ...base(), items: [{ ...base().items[0], productId: { $ne: '' } }] })))
        .status,
    ).toBe(400)
    expect(
      (await POST(request({ ...base(), customer: { ...customer, name: '<script>' } }))).status,
    ).toBe(400)
    expect(mock.getPayload).not.toHaveBeenCalled()
  })
})

describe('Minimal exact-match order tracking', () => {
  it('never returns customer PII, payment proof, internal notes, product data or totals', async () => {
    mock.find.mockResolvedValue({
      docs: [
        {
          id: 'secret',
          orderNumber: '#NKI-123456',
          status: 'shipped',
          createdAt: '2026-01-01',
          customer,
          paymentProof: { screenshot: 'private' },
          notes: 'private',
          totalAmount: 999,
          fulfillment: {
            courierName: 'TCS',
            trackingNumber: 'T123',
            trackingUrl: 'javascript:alert(1)',
          },
        },
      ],
    })
    const result = await track(
      new Request('https://store.example/api/orders/track?orderNumber=123456&contact=03001234567'),
    )
    expect(result.status).toBe(200)
    const body = await result.json()
    expect(Object.keys(body.order).sort()).toEqual([
      'createdAt',
      'fulfillment',
      'orderNumber',
      'status',
    ])
    expect(body.order.fulfillment.trackingUrl).toBeUndefined()
    expect(JSON.stringify(mock.find.mock.calls[0][0].where)).not.toContain('contains')
    expect(result.headers.get('cache-control')).toBe('private, no-store')
  })
  it('rejects partial order/contact searches before initializing Payload', async () => {
    for (const query of [
      'orderNumber=letters&contact=0',
      'orderNumber=123&contact=03001234567',
      'orderNumber=123456&contact=1',
    ]) {
      expect(
        (await track(new Request(`https://store.example/api/orders/track?${query}`))).status,
      ).toBe(400)
    }
    expect(mock.getPayload).not.toHaveBeenCalled()
  })
})
