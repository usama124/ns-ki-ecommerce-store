import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { isStorefrontPaymentMethod, unavailablePaymentMessage } from '@/utilities/storefrontPayments'
import { validatePakistanLocation } from '@/utilities/pakistanLocations'

function parseProductId(rawId: any): number | string {
  if (typeof rawId === 'object' && rawId !== null) {
    rawId = rawId.id
  }
  if (typeof rawId === 'number') return rawId
  if (typeof rawId === 'string' && rawId.trim() !== '') {
    const num = Number(rawId)
    if (!isNaN(num)) return num
    return rawId.trim()
  }
  return rawId
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { customer, items, paymentMethod, paymentProof, subtotal, shippingFee } = body

    if (
      !customer?.name ||
      !customer?.phone ||
      !customer?.address ||
      !customer?.city ||
      !customer?.province
    ) {
      return NextResponse.json({ error: 'Missing required customer details.' }, { status: 400 })
    }

    const locationError = validatePakistanLocation(customer.province, customer.city)
    if (locationError) return NextResponse.json({ error: locationError }, { status: 400 })
    customer.city = customer.city.trim().normalize('NFC')

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart items cannot be empty.' }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required.' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    let siteSettings
    try {
      siteSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: false })
    } catch {
      return NextResponse.json({ error: 'Payment options are temporarily unavailable. Please try again.' }, { status: 503 })
    }
    if (!isStorefrontPaymentMethod(paymentMethod, siteSettings)) {
      return NextResponse.json({ error: unavailablePaymentMessage }, { status: 400 })
    }

    if (paymentMethod !== 'cod' && !paymentProof?.transactionId && !paymentProof?.screenshot) {
      return NextResponse.json(
        { error: 'Please provide TRX ID or screenshot proof for digital payment.' },
        { status: 400 },
      )
    }

    // Never trust a browser-supplied COD fee when the admin enables COD.
    const effectiveCodFee = paymentMethod === 'cod' ? siteSettings.shipping?.codFee ?? 250 : 0
    if (typeof effectiveCodFee !== 'number' || !Number.isFinite(effectiveCodFee) || effectiveCodFee < 0) {
      return NextResponse.json({ error: 'COD charges are temporarily unavailable. Please choose another payment method.' }, { status: 503 })
    }

    const computedTotal = subtotal + shippingFee + effectiveCodFee

    const formattedItems = items.map((item: any) => {
      const parsedId = parseProductId(item.productId ?? item.product)
      return {
        product: parsedId,
        variantSize: item.variantSize,
        variantSku: item.variantSku || 'NKI-SKU',
        quantity: item.quantity,
        unitPrice: item.price,
      }
    })

    const orderData: any = {
      customer,
      items: formattedItems,
      paymentMethod,
      paymentProof: paymentMethod === 'cod' ? undefined : paymentProof,
      subtotal,
      shippingFee,
      codFee: effectiveCodFee,
      totalAmount: computedTotal,
      status: 'pending_verification',
    }

    const orderDoc = await payload.create({
      collection: 'orders',
      data: orderData,
      draft: false,
      overrideAccess: true,
    } as any)

    return NextResponse.json({
      success: true,
      orderNumber: (orderDoc as any).orderNumber || `#NKI-${orderDoc.id}`,
      orderId: orderDoc.id,
    })
  } catch (error: any) {
    console.error('Error submitting order to Payload:', error)
    const message = error?.message || 'An error occurred while placing order.'
    const isBadRequest =
      error?.name === 'ValidationError' ||
      error?.status === 400 ||
      message.toLowerCase().includes('stock') ||
      message.toLowerCase().includes('invalid') ||
      message.toLowerCase().includes('constraint')

    return NextResponse.json({ error: message }, { status: isBadRequest ? 400 : 500 })
  }
}
