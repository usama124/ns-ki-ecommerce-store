// Shared by checkout, footer and server guards. Missing legacy fields retain rollout defaults.
export const storefrontPaymentMethods = ['cod', 'bank_transfer', 'jazzcash', 'easypaisa'] as const
export type StorefrontPaymentMethod = (typeof storefrontPaymentMethods)[number]
export type PaymentSettings = {
  paymentMethods?: Partial<Record<StorefrontPaymentMethod, boolean | null>> | null
}
export const defaultPaymentMethods = {
  cod: false,
  bank_transfer: true,
  jazzcash: false,
  easypaisa: true,
} as const
export const closedPaymentSettings: PaymentSettings = {
  paymentMethods: { cod: false, bank_transfer: false, jazzcash: false, easypaisa: false },
}
export const paymentMethodLabels: Record<StorefrontPaymentMethod, string> = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank / Raast Transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
}
export const unavailablePaymentMessage =
  'This payment method is currently unavailable. Please refresh checkout and choose an available method.'

export function enabledPaymentMethods(settings?: PaymentSettings | null) {
  return storefrontPaymentMethods.filter((method) => {
    const value = settings?.paymentMethods?.[method]
    return value == null ? defaultPaymentMethods[method] : value === true
  })
}

export function isStorefrontPaymentMethod(
  value: unknown,
  settings?: PaymentSettings | null,
): value is (typeof storefrontPaymentMethods)[number] {
  return (
    typeof value === 'string' && enabledPaymentMethods(settings).some((method) => method === value)
  )
}

export function getStorefrontPaymentNote(settings?: PaymentSettings | null) {
  const methods = enabledPaymentMethods(settings)
  return methods.length
    ? `We accept ${methods.map((method) => paymentMethodLabels[method]).join(' · ')}`
    : 'Online ordering is temporarily unavailable.'
}
