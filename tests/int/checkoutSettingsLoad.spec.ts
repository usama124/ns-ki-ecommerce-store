// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), findGlobal: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/components/checkout/CheckoutPage', () => ({ CheckoutPage: () => null }))
import Checkout from '@/app/(app)/checkout/page'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPayload.mockResolvedValue({ findGlobal: mocks.findGlobal })
})
it('populates QR media while respecting public access and reading fresh settings', async () => {
  const settings = { paymentDetails: { bankTransfer: { qrCode: { url: '/bank.png', mimeType: 'image/png' } } } }
  mocks.findGlobal.mockResolvedValue(settings)
  const page = await Checkout()
  expect(mocks.findGlobal).toHaveBeenCalledWith({ slug: 'site-settings', depth: 1, overrideAccess: false })
  expect(page.props.siteSettings).toBe(settings)
})
it('fails checkout closed if settings cannot load', async () => {
  mocks.findGlobal.mockRejectedValue(new Error('unavailable'))
  expect((await Checkout()).props.siteSettings.paymentMethods).toEqual({ cod: false, bank_transfer: false, jazzcash: false, easypaisa: false })
})
