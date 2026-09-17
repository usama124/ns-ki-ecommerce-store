import { Resend } from 'resend'
import {
    getNewOrderAdminAlertEmailHtml,
    getOrderRejectedCustomerEmailHtml,
    getOrderShippedCustomerEmailHtml,
    getPaymentConfirmedCustomerEmailHtml
} from './emailTemplates'

const resendApiKey = process.env.RESEND_API_KEY || ''
const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'
const adminEmail = process.env.ADMIN_EMAIL || 'admin@nski.pk'
const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const resend = resendApiKey ? new Resend(resendApiKey) : null

/**
 * Timeout wrapper for email dispatches to prevent long-hanging API requests.
 */
function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Resend API dispatch timed out after ${ms}ms`)), ms),
    ),
  ])
}

/**
 * Robust wrapper around resend.emails.send handling Resend error responses & testing mode fallback.
 */
async function sendEmailWithResend({
  from,
  to,
  subject,
  html,
}: {
  from: string
  to: string
  subject: string
  html: string
}) {
  if (!resend) return

  try {
    const res = (await withTimeout(
      resend.emails.send({
        from,
        to,
        subject,
        html,
      }),
    )) as any

    if (res?.error) {
      console.warn(`[Resend Error] Failed to send email to ${to}:`, res.error.message)

      // Resend Free Tier restriction: onboarding@resend.dev can only send to account owner's email.
      // If customer email is blocked during testing, send a test copy to ADMIN_EMAIL.
      if (
        fromEmail.includes('onboarding@resend.dev') &&
        to !== adminEmail &&
        (res.error.message?.includes('testing') || res.error.message?.includes('verify'))
      ) {
        console.log(
          `[Resend Test Mode] Sending customer email copy for ${to} to verified admin address (${adminEmail})`,
        )
        await resend.emails.send({
          from: `N's KI Store <${fromEmail}>`,
          to: adminEmail,
          subject: `[TEST FOR ${to}] ${subject}`,
          html,
        })
      }
    } else if (res?.data) {
      console.log(`[Resend Success] Sent email to ${to} (ID: ${res.data.id})`)
    }
  } catch (err: any) {
    console.warn(`[Resend Error] Exception sending email to ${to}:`, err?.message || err)
  }
}

/**
 * Send admin alert email when a new order is placed.
 */
export async function sendAdminOrderPlacedAlert(order: any): Promise<void> {
  if (!resend || !adminEmail) return

  const adminHtml = getNewOrderAdminAlertEmailHtml(order, siteUrl)
  await sendEmailWithResend({
    from: `N's KI Alerts <${fromEmail}>`,
    to: adminEmail,
    subject: `🚨 NEW ORDER ${order.orderNumber} - ${order.customer?.name || 'Customer'} (${order.paymentMethod?.toUpperCase() || ''})`,
    html: adminHtml,
  })
}

/**
 * Send customer order confirmation email (when order is confirmed, e.g. COD or after payment verification).
 */
export async function sendCustomerOrderConfirmedEmail(order: any): Promise<void> {
  const customerEmail = order.customer?.email
  if (!customerEmail) return

  const customerHtml = getPaymentConfirmedCustomerEmailHtml(order, siteUrl)
  await sendEmailWithResend({
    from: `N's KI Store <${fromEmail}>`,
    to: customerEmail,
    subject: `Order Confirmed - ${order.orderNumber} - N's KI`,
    html: customerHtml,
  })
}

/**
 * Send customer order cancellation / rejection email with specified reason.
 */
export async function sendCustomerOrderRejectedEmail(order: any): Promise<void> {
  const customerEmail = order.customer?.email
  if (!customerEmail) return

  const customerHtml = getOrderRejectedCustomerEmailHtml(order, siteUrl)
  await sendEmailWithResend({
    from: `N's KI Orders <${fromEmail}>`,
    to: customerEmail,
    subject: `Order Update - ${order.orderNumber} - N's KI`,
    html: customerHtml,
  })
}

/**
 * Send customer shipping notification email when order is dispatched.
 */
export async function sendCustomerOrderShippedEmail(order: any): Promise<void> {
  const customerEmail = order.customer?.email
  if (!customerEmail) return

  const customerHtml = getOrderShippedCustomerEmailHtml(order, siteUrl)
  await sendEmailWithResend({
    from: `N's KI Shipping <${fromEmail}>`,
    to: customerEmail,
    subject: `Your Parcel Has Shipped! - Order ${order.orderNumber} - N's KI`,
    html: customerHtml,
  })
}

/**
 * Backwards-compat helper for order creation.
 */
export async function sendOrderPlacedEmails(order: any): Promise<void> {
  await sendAdminOrderPlacedAlert(order)
}

/**
 * Backwards-compat helper for status update transitions.
 */
export async function sendStatusUpdateEmail(order: any, previousStatus?: string): Promise<void> {
  const currentStatus = order.status
  if (currentStatus === previousStatus) return

  if (
    (currentStatus === 'confirmed' || currentStatus === 'processing') &&
    previousStatus !== 'confirmed' &&
    previousStatus !== 'processing'
  ) {
    await sendCustomerOrderConfirmedEmail(order)
  } else if (currentStatus === 'cancelled' && previousStatus !== 'cancelled') {
    await sendCustomerOrderRejectedEmail(order)
  } else if (currentStatus === 'shipped' && previousStatus !== 'shipped') {
    await sendCustomerOrderShippedEmail(order)
  }
}
