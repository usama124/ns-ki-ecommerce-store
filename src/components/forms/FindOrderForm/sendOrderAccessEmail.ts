'use server'

import { getServerSideURL } from '@/utilities/getURL'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { signOrderAccess } from '@/utilities/orderAccess'
import { headers } from 'next/headers'
import { enforceRequestLimit } from '@/utilities/requestLimits'

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
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof orderID !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(orderID)) return { success: true }
  const payload = await getPayload({ config: configPromise })

  try {
    await enforceRequestLimit(payload, await headers(), 'recovery', email.toLowerCase())
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
    const orderURL = `${serverURL}/orders/${encodeURIComponent(order.id)}?token=${signOrderAccess(order.id, payload.config.secret)}`

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
  } catch {
    payload.logger.error({ msg: 'Order access email request could not be completed' })
    return { success: true }
  }
}
