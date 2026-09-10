import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      customer,
      items,
      paymentMethod,
      paymentProof,
      subtotal,
      shippingFee,
      totalAmount,
    } = body

    if (!customer?.name || !customer?.phone || !customer?.address || !customer?.city || !customer?.province) {
      return NextResponse.json({ error: 'Missing required customer details.' }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart items cannot be empty.' }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required.' }, { status: 400 })
    }

    if (paymentMethod !== 'cod') {
      if (!paymentProof?.transactionId && !paymentProof?.screenshot) {
        return NextResponse.json(
          { error: 'Please provide TRX ID or screenshot proof for digital payment.' },
          { status: 400 }
        )
      }
    }

    const payload = await getPayload({ config: configPromise })

    const orderData: any = {
      customer,
      items: items.map((item: any) => ({
        product: item.productId,
        variantSize: item.variantSize,
        variantSku: item.variantSku || 'LUJ-SKU',
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      paymentMethod,
      paymentProof: paymentMethod !== 'cod' ? paymentProof : undefined,
      subtotal,
      shippingFee,
      totalAmount,
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
      orderNumber: (orderDoc as any).orderNumber || `#LUJ-${orderDoc.id}`,
      orderId: orderDoc.id,
    })
  } catch (error: any) {
    console.error('Error submitting order to Payload:', error)
    const message = error?.message || 'An error occurred while placing order.'
    const isStockError = message.toLowerCase().includes('stock')
    return NextResponse.json(
      { error: message },
      { status: isStockError ? 400 : 500 }
    )
  }
}
