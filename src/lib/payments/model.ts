import { RequestError, validDocumentID } from '@/utilities/apiSecurity'

export const collectionReasons = ['customer_payment', 'cod_remittance'] as const
export const refundReasons = ['return', 'cancellation', 'overpayment', 'correction'] as const
export const moneyMethods = ['cash', 'bank_transfer', 'jazzcash', 'easypaisa'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function moneyMinor(amount: unknown) {
  if (typeof amount !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(amount))
    throw new RequestError('Enter a PKR amount with at most two decimal places.')
  const [whole, fraction = ''] = amount.split('.')
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (value < 1) throw new RequestError('Amount must be positive.')
  return value
}
export function totalMinor(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 999999999)
    throw new RequestError('Order total cannot be reconciled.', 409)
  const result = Math.round(value * 100)
  if (Math.abs(value * 100 - result) > 0.0001)
    throw new RequestError('Order total has unsupported precision.', 409)
  return result
}
export function parseMoneyCommand(body: Record<string, unknown>, now = new Date()) {
  const allowed = ['key', 'orderId', 'kind', 'amount', 'method', 'reason', 'occurredAt', 'refundOf']
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new RequestError('Unsupported payment field.')
  if (typeof body.key !== 'string' || !uuid.test(body.key))
    throw new RequestError('A valid submission key is required.')
  if (typeof body.orderId !== 'string' || !validDocumentID(body.orderId))
    throw new RequestError('A valid order ID is required.')
  if (body.kind !== 'collection' && body.kind !== 'refund')
    throw new RequestError('Invalid money event kind.')
  if (!(moneyMethods as readonly unknown[]).includes(body.method))
    throw new RequestError('Invalid actual payment method.')
  const reasons = body.kind === 'collection' ? collectionReasons : refundReasons
  if (!(reasons as readonly unknown[]).includes(body.reason))
    throw new RequestError('Choose an appropriate payment/refund reason.')
  const refundOf = body.refundOf || ''
  if (
    typeof refundOf !== 'string' ||
    (body.kind === 'refund' ? !uuid.test(refundOf) : Boolean(refundOf))
  )
    throw new RequestError('Refunds must link to a recorded collection.')
  const time = typeof body.occurredAt === 'string' ? new Date(body.occurredAt) : new Date(NaN)
  if (
    typeof body.occurredAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(body.occurredAt) ||
    !Number.isFinite(time.getTime()) ||
    time.toISOString().replace('.000Z', 'Z') !== body.occurredAt.replace('.000Z', 'Z') ||
    time.getTime() > now.getTime() + 300000 ||
    time.getUTCFullYear() < 2000
  )
    throw new RequestError('Choose a valid actual payment time, not a future date.')
  return {
    key: body.key.toLowerCase(),
    orderId: body.orderId,
    kind: body.kind,
    amountMinor: moneyMinor(body.amount),
    method: body.method as string,
    reason: body.reason as string,
    occurredAt: time.toISOString(),
    refundOf: refundOf.toLowerCase(),
  }
}
export type MoneyCommand = ReturnType<typeof parseMoneyCommand>
