'use server'

import { getServerSideURL } from '@/utilities/getURL'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

type SendOrderAccessEmailArgs = {
  email: string
  orderID: string
}

type SendOrderAccessEmailResult = {
  success: boolean
  error?: string
}

export async function sendOrderAccessEmail({
  email,
  orderID,
}: SendOrderAccessEmailArgs): Promise<SendOrderAccessEmailResult> {
  const payload = await getPayload({ config: configPromise })

  try {
    const { docs: orders } = await payload.find({
      collection: 'orders',
      where: {
        and: [{ id: { equals: orderID } }, { 'customer.email': { equals: email } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const order = orders[0]

    if (!order) {
      return { success: true }
    }

    const serverURL = getServerSideURL()
    const orderURL = `${serverURL}/orders/${order.id}`

    const emailBody = `
        <h1>View Your N's KI Order</h1>
        <p>Click the link below to view your order details:</p>
        <p><a href="${orderURL}">View Order #${order.orderNumber || order.id}</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${orderURL}</p>
      `

    await payload.sendEmail({
      to: email,
      subject: `N's KI Order #${order.orderNumber || order.id}`,
      html: emailBody,
    })

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to send order access email', err })
    return { success: true }
  }
}
