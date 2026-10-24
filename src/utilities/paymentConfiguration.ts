const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
const value = (input: unknown) => (typeof input === 'string' ? input.trim() : '')

/** Presence checks only, not bank verification. Never display template destinations. */
export function paymentConfigured(settings: unknown, method: string): boolean {
  if (method === 'cod') return true
  const details = object(object(settings).paymentDetails)
  if (method === 'bank_transfer') {
    const bank = object(details.bankTransfer)
    const account = value(bank.accountNumber).replace(/\s/g, '')
    const raast = value(bank.raastId).replace(/\D/g, '')
    return Boolean(
      value(bank.bankName) &&
      value(bank.accountTitle) &&
      ((account.length >= 10 && !account.startsWith('PK00')) ||
        (raast.length >= 10 && raast !== '03001234567')),
    )
  }
  if (method === 'jazzcash' || method === 'easypaisa') {
    const wallet = object(details[method])
    const phone = value(wallet.mobileNumber).replace(/\D/g, '')
    return Boolean(
      value(wallet.accountName) && /^\d{10,15}$/.test(phone) && phone !== '03001234567',
    )
  }
  return false
}
