// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), findGlobal: vi.fn(), coverage: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/utilities/instaworldCities', () => ({ getCodCoverage: mocks.coverage }))
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
it('loads courier coverage only when COD is enabled and leaves other methods available on failure', async () => {
  const settings = { paymentMethods: { cod: true, bank_transfer: true } }
  mocks.findGlobal.mockResolvedValue(settings)
  mocks.coverage.mockResolvedValue({ cities: [{ province: 'Punjab', name: 'LAHORE', label: 'Lahore' }], checkedAt: '2026-11-12T00:00:00Z' })
  expect((await Checkout()).props.codCoverage?.cities[0].name).toBe('LAHORE')
  mocks.coverage.mockRejectedValue(new Error('provider offline'))
  const page = await Checkout()
  expect(page.props.siteSettings).toBe(settings)
  expect(page.props.codCoverage).toBeNull()
})
