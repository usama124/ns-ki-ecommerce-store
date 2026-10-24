import configPromise from '@payload-config'
import { privateJSON, RequestError, requestError } from '@/utilities/apiSecurity'
import { getPayload } from 'payload'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderNumQuery = searchParams.get('orderNumber')?.trim() || ''
    const contactQuery = searchParams.get('contact')?.trim() || ''

    if (!/^(?:#?(?:NKI|LUJ)-)?\d{6}$/i.test(orderNumQuery) || contactQuery.length > 254) throw new RequestError('Enter a valid six-digit order number and full phone number or email.')
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactQuery)
    if (!isEmail && (!/^\+?\d[\d ()-]{8,19}$/.test(contactQuery) || !/^\d{10,15}$/.test(contactQuery.replace(/\D/g, '')))) throw new RequestError('Enter your full registered phone number or email.')

    // Normalize order number formatting (e.g. 920182 -> #NKI-920182)
    const cleanNumberStr = orderNumQuery.replace(/[^0-9]/g, '')
    const formattedNkiNum = `#NKI-${cleanNumberStr}`
    const formattedLujNum = `#LUJ-${cleanNumberStr}`

    const payload = await getPayload({ config: configPromise })

    // Find order matching number AND contact phone or email
    const result = await payload.find({
      collection: 'orders',
      depth: 0,
      limit: 1,
      pagination: false,
      select: { orderNumber: true, status: true, createdAt: true, fulfillment: true },
      overrideAccess: true,
      where: {
        and: [
          {
            or: [
              { orderNumber: { equals: formattedNkiNum } },
              { orderNumber: { equals: formattedLujNum } },
            ],
          },
          isEmail ? { 'customer.email': { equals: contactQuery.toLowerCase() } } : { 'customer.phone': { equals: contactQuery } },
        ],
      },
    })

    const order = result.docs?.[0]

    if (!order) {
      return privateJSON(
        {
          error:
            'No matching order found. Please verify your order number and contact information.',
        },
        404,
      )
    }

    return privateJSON({
      success: true,
      order: {
        orderNumber: order.orderNumber, status: order.status, createdAt: order.createdAt,
        fulfillment: order.fulfillment ? {
          courierName: order.fulfillment.courierName,
          trackingNumber: order.fulfillment.trackingNumber,
          trackingUrl: /^https:\/\//i.test(order.fulfillment.trackingUrl || '') ? order.fulfillment.trackingUrl : undefined,
        } : undefined,
      },
    })
  } catch (error) {
    return requestError(error)
  }
}
