import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderNumQuery = searchParams.get('orderNumber')?.trim() || ''
    const contactQuery = searchParams.get('contact')?.trim() || ''

    if (!orderNumQuery || !contactQuery) {
      return NextResponse.json(
        { error: 'Please provide both Order Number and Phone or Email.' },
        { status: 400 }
      )
    }

    // Normalize order number formatting (e.g. 920182 -> #LUJ-920182, #NKI-920182 -> #LUJ-920182, etc.)
    const cleanNumberStr = orderNumQuery.replace(/[^0-9]/g, '')
    const formattedNum = `#LUJ-${cleanNumberStr}`

    const payload = await getPayload({ config: configPromise })

    // Find order matching number AND contact phone or email
    const result = await payload.find({
      collection: 'orders',
      depth: 2,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          {
            or: [
              { orderNumber: { equals: orderNumQuery } },
              { orderNumber: { equals: formattedNum } },
              { orderNumber: { contains: cleanNumberStr } },
            ],
          },
          {
            or: [
              { 'customer.phone': { contains: contactQuery } },
              { 'customer.email': { equals: contactQuery } },
            ],
          },
        ],
      },
    })

    const order = result.docs?.[0]

    if (!order) {
      return NextResponse.json(
        { error: 'No matching order found. Please verify your order number and contact information.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      order,
    })
  } catch (error: any) {
    console.error('Error tracking order:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to search order tracking details.' },
      { status: 500 }
    )
  }
}
