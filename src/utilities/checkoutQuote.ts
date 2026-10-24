import type { Payload } from 'payload'
import { RequestError, validDocumentID } from './apiSecurity'
import { getSalePriceDetails } from './getSalePrice'
import { calculateShipping } from './shipping'
import { paymentConfigured } from './paymentConfiguration'

type Line = { productId: string; variantSize: string; quantity: number }
const text = (value: unknown, max: number, optional = false) => {
  if (optional && (value === undefined || value === '')) return ''
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f<>]/.test(value)
  )
    throw new RequestError('Invalid customer or cart details.')
  return value.trim()
}
const money = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000)
    throw new RequestError('Pricing configuration is unavailable.', 503)
  return value
}

export function parseCheckout(body: Record<string, unknown>) {
  const customer = body.customer as Record<string, unknown> | undefined
  if (!customer || typeof customer !== 'object' || Array.isArray(customer))
    throw new RequestError('Customer details are required.')
  const details = {
    name: text(customer.name, 120),
    phone: text(customer.phone, 30),
    email: text(customer.email, 254, true).toLowerCase(),
    city: text(customer.city, 100),
    province: text(customer.province, 100),
    address: text(customer.address, 500),
  }
  if (
    !/^\+?\d[\d ()-]{8,19}$/.test(details.phone) ||
    !/^\d{10,15}$/.test(details.phone.replace(/\D/g, '')) ||
    (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email))
  )
    throw new RequestError('Provide a valid phone number and email.')
  if (!['cod', 'bank_transfer', 'jazzcash', 'easypaisa'].includes(String(body.paymentMethod)))
    throw new RequestError('Invalid payment method.')
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50)
    throw new RequestError('Cart must contain 1–50 items.')
  const lines = new Map<string, Line>()
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new RequestError('Invalid cart item.')
    const rawID = raw.productId ?? raw.product
    if (!validDocumentID(rawID)) throw new RequestError('Invalid product ID.')
    const productId = String(rawID)
    const variantSize = text(raw.variantSize, 60)
    if (!Number.isSafeInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 99)
      throw new RequestError('Quantity must be a whole number between 1 and 99.')
    const key = `${productId}:${variantSize.toLowerCase()}`
    const quantity = (lines.get(key)?.quantity || 0) + raw.quantity
    if (quantity > 99) throw new RequestError('Maximum quantity per variant is 99.')
    lines.set(key, { productId, variantSize, quantity })
  }
  const proof = body.paymentProof as Record<string, unknown> | undefined
  const paymentProof =
    body.paymentMethod !== 'cod' && proof && typeof proof === 'object'
      ? {
          transactionId:
            proof.transactionId === undefined
              ? undefined
              : text(proof.transactionId, 100)
                  .replace(/[^a-zA-Z0-9]/g, '')
                  .toUpperCase(),
          screenshot: undefined,
        }
      : undefined
  if (proof?.screenshot)
    throw new RequestError(
      'Screenshot uploads are unavailable until private receipt storage is configured. Please enter the transaction reference instead.',
    )
  if (body.paymentMethod !== 'cod' && !paymentProof?.transactionId)
    throw new RequestError('Provide a transaction reference.')
  if (paymentProof?.transactionId && !/^[A-Z0-9]{6,18}$/.test(paymentProof.transactionId))
    throw new RequestError('Transaction reference must contain 6–18 letters or digits.')
  return {
    customer: details,
    lines: [...lines.values()],
    paymentMethod: body.paymentMethod as 'cod' | 'bank_transfer' | 'jazzcash' | 'easypaisa',
    paymentProof,
  }
}

/** Only database values contribute to prices, fees, variant identity and totals. */
export async function quoteCheckout(payload: Payload, input: ReturnType<typeof parseCheckout>) {
  const [result, settings, sale] = await Promise.all([
    payload.find({
      collection: 'products',
      where: {
        and: [
          { id: { in: input.lines.map((line) => line.productId) } },
          { status: { equals: 'published' } },
        ],
      },
      depth: 1,
      pagination: false,
      overrideAccess: false,
      select: {
        title: true,
        basePricePKR: true,
        primaryCategory: true,
        categories: true,
        variants: true,
      },
    }),
    payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: false }),
    payload.findGlobal({ slug: 'sale-settings', depth: 0, overrideAccess: false }),
  ])
  if (!settings?.shipping)
    throw new RequestError('Shipping settings are temporarily unavailable.', 503)
  if (!paymentConfigured(settings, input.paymentMethod))
    throw new RequestError(
      'This payment method is not configured. Please choose another method.',
      503,
    )
  const shipping = settings.shipping
  for (const value of [
    shipping.freeShippingThreshold,
    shipping.majorCityFee,
    shipping.secondaryCityFee,
    shipping.codFee,
  ])
    money(value)
  const items = input.lines.map((line) => {
    const product = result.docs.find((product) => String(product.id) === line.productId)
    const variants = product?.variants?.filter((variant) => {
      const size = variant.size
      return (
        typeof size === 'object' &&
        size &&
        [String(size.id), size.name].some(
          (value) => value?.trim().toLowerCase() === line.variantSize.toLowerCase(),
        )
      )
    })
    if (!product || variants?.length !== 1)
      throw new RequestError('A selected product or size is no longer available.', 409)
    const variant = variants[0]
    if (!variant.allowBackorder && (variant.stock ?? 0) < line.quantity)
      throw new RequestError('There is insufficient stock for a selected size.', 409)
    const unitPrice = money(getSalePriceDetails(product, sale, variant.pricePKR).effectivePrice)
    return {
      product: product.id,
      variantSize: typeof variant.size === 'object' ? variant.size.name : line.variantSize,
      variantSku: variant.sku || '',
      quantity: line.quantity,
      unitPrice,
    }
  })
  const subtotal = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
  const shippingFee = money(calculateShipping(input.customer.city, subtotal, shipping))
  const codFee = input.paymentMethod === 'cod' ? money(shipping.codFee) : 0
  return {
    items,
    subtotal,
    shippingFee,
    codFee,
    totalAmount: money(subtotal + shippingFee + codFee),
  }
}
