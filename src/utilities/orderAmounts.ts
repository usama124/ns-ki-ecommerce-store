import { RequestError } from './apiSecurity'

type FinancialOrder = {
  items?: { quantity: number; unitPrice: number }[] | null
  shippingFee?: number | null
  codFee?: number | null
  paymentMethod?: string | null
}
const amount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000)
    throw new RequestError('Order amounts must be non-negative whole PKR values.')
  return value
}

/** Accepted line prices/fees are snapshots. Never silently reprice old orders from today's catalog. */
export function orderAmounts(data: FinancialOrder, previous?: FinancialOrder) {
  const order = { ...previous, ...data }
  if (!Array.isArray(order.items) || !order.items.length || order.items.length > 50)
    throw new RequestError('An order must contain 1–50 items.')
  let subtotal = 0
  for (const item of order.items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
      throw new RequestError('Quantity must be a whole number between 1 and 99.')
    subtotal = amount(subtotal + amount(item.unitPrice) * item.quantity)
  }
  const shippingFee = amount(order.shippingFee)
  const codFee = order.paymentMethod === 'cod' ? amount(order.codFee ?? 0) : 0
  return { subtotal, shippingFee, codFee, totalAmount: amount(subtotal + shippingFee + codFee) }
}
