import { formatPKR } from './formatPKR'

interface OrderItem {
  product?: any
  variantSize?: string
  variantColor?: string
  variantSku?: string
  quantity: number
  unitPrice: number
}

interface OrderCustomer {
  name?: string
  email?: string
  phone?: string
  city?: string
  province?: string
  address?: string
}

interface OrderFulfillment {
  courierName?: string
  trackingNumber?: string
  trackingUrl?: string
}

interface OrderData {
  id?: string
  orderNumber?: string
  status?: string
  paymentMethod?: string
  customer?: OrderCustomer
  items?: OrderItem[]
  subtotal?: number
  shippingFee?: number
  codFee?: number
  totalAmount?: number
  fulfillment?: OrderFulfillment
  cancellationReason?: string
  notes?: string
  createdAt?: string
}

function getPaymentMethodLabel(method?: string): string {
  switch (method) {
    case 'cod':
      return 'Cash on Delivery (COD)'
    case 'bank_transfer':
      return 'Bank / Raast Transfer'
    case 'jazzcash':
      return 'JazzCash'
    case 'easypaisa':
      return 'EasyPaisa'
    default:
      return method || 'Direct Payment'
  }
}

function getItemTitle(item: OrderItem): string {
  if (item.product && typeof item.product === 'object' && item.product.title) {
    return item.product.title
  }
  return 'Product Item'
}

/**
  1. CUSTOMER ORDER CONFIRMATION EMAIL
 */
export function getOrderPlacedCustomerEmailHtml(order: OrderData, siteUrl: string): string {
  const customerName = order.customer?.name || 'Valued Customer'
  const trackingLink = `${siteUrl.replace(/\/$/, '')}/track-order?orderNumber=${encodeURIComponent(
    order.orderNumber || '',
  )}`

  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b;">
          <strong>${getItemTitle(item)}</strong>
          ${
            item.variantSize || item.variantColor
              ? `<br><span style="font-size: 12px; color: #64748b;">Size: ${item.variantSize || 'OS'}${
                  item.variantColor ? ` | Color: ${item.variantColor}` : ''
                }</span>`
              : ''
          }
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: right; font-weight: 600;">
          ${formatPKR(item.unitPrice * item.quantity)}
        </td>
      </tr>
    `,
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - N's KI</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" maxWidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.25em; text-transform: uppercase; font-family: Georgia, serif;">N'S KI</h1>
                  <p style="color: #cbd5e1; margin: 6px 0 0 0; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">Pakistani Luxury Fashion</p>
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding: 32px 24px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #0f172a;">Thank You for Your Order, ${customerName}!</h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    We have received your order <strong>${order.orderNumber}</strong>. Our artisans and order management team are preparing it with care.
                  </p>

                  <!-- Order Summary Box -->
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 13px; color: #64748b;">Order Reference:</td>
                        <td style="font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">${order.orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; padding-top: 8px;">Payment Method:</td>
                        <td style="font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; padding-top: 8px;">${getPaymentMethodLabel(order.paymentMethod)}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- Items Table -->
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Order Details</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569;">Item</th>
                        <th style="padding: 10px 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #475569;">Qty</th>
                        <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #475569;">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>

                  <!-- Price Breakdown -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; font-size: 14px;">
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
                      <td style="padding: 4px 0; color: #0f172a; text-align: right;">${formatPKR(order.subtotal || 0)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Shipping Fee:</td>
                      <td style="padding: 4px 0; color: #0f172a; text-align: right;">${formatPKR(order.shippingFee || 0)}</td>
                    </tr>
                    ${
                      order.codFee
                        ? `<tr>
                      <td style="padding: 4px 0; color: #64748b;">COD Service Fee:</td>
                      <td style="padding: 4px 0; color: #0f172a; text-align: right;">${formatPKR(order.codFee)}</td>
                    </tr>`
                        : ''
                    }
                    <tr>
                      <td style="padding: 12px 0 0 0; color: #0f172a; font-weight: 700; font-size: 16px; border-top: 2px solid #0f172a;">Total Amount:</td>
                      <td style="padding: 12px 0 0 0; color: #0f172a; font-weight: 700; font-size: 16px; text-align: right; border-top: 2px solid #0f172a;">${formatPKR(order.totalAmount || 0)}</td>
                    </tr>
                  </table>

                  <!-- Delivery Address -->
                  <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #0f172a; text-transform: uppercase;">Shipping Address</h3>
                  <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #475569; background-color: #f8fafc; padding: 12px; border-radius: 6px;">
                    ${order.customer?.name || ''}<br>
                    ${order.customer?.address || ''}<br>
                    ${order.customer?.city || ''}, ${order.customer?.province || ''}<br>
                    Phone: ${order.customer?.phone || ''}
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin-top: 32px;">
                    <a href="${trackingLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; text-decoration: none; border-radius: 6px;">
                      Track Order Status
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                  If you have questions about your order, reply to this email or contact us at <a href="mailto:info@nski.pk" style="color: #0f172a;">info@nski.pk</a>.<br>
                  © ${new Date().getFullYear()} N's KI. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
  2. INSTANT ADMIN ALERT EMAIL
 */
export function getNewOrderAdminAlertEmailHtml(order: OrderData, siteUrl: string): string {
  const adminDashboardLink = `${siteUrl.replace(/\/$/, '')}/store-admin/orders-dashboard`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order Alert - N's KI Admin</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" maxWidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              
              <td style="background-color: #0f172a; padding: 24px; text-align: center;">
                <span style="display: inline-block; background-color: #d97706; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; border-radius: 4px; margin-bottom: 8px;">NEW STORE ORDER</span>
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-family: Georgia, serif;">Order ${order.orderNumber} Received</h1>
              </td>

              <tr>
                <td style="padding: 24px;">
                  <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
                    A new customer order has been placed on <strong>N's KI Store</strong>.
                  </p>

                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                      <tr>
                        <td style="color: #64748b; padding-bottom: 6px;">Customer Name:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding-bottom: 6px;">${order.customer?.name || 'Guest'}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding-bottom: 6px;">Phone (+92):</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding-bottom: 6px;">${order.customer?.phone || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding-bottom: 6px;">City / Province:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding-bottom: 6px;">${order.customer?.city || ''}, ${order.customer?.province || ''}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding-bottom: 6px;">Payment Method:</td>
                        <td style="color: #0f172a; font-weight: 600; text-align: right; padding-bottom: 6px;">${getPaymentMethodLabel(order.paymentMethod)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding-top: 6px; border-top: 1px solid #e2e8f0; font-weight: 700;">Total Amount:</td>
                        <td style="color: #d97706; font-weight: 700; text-align: right; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 15px;">${formatPKR(order.totalAmount || 0)}</td>
                      </tr>
                    </table>
                  </div>

                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${adminDashboardLink}" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 24px; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; text-decoration: none; border-radius: 6px;">
                      Open Orders Dashboard
                    </a>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b;">
                  N's KI E-Commerce Store Admin Alerts
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
  3. PAYMENT CONFIRMED / PROCESSING EMAIL
 */
export function getPaymentConfirmedCustomerEmailHtml(order: OrderData, siteUrl: string): string {
  const customerName = order.customer?.name || 'Valued Customer'
  const trackingLink = `${siteUrl.replace(/\/$/, '')}/track-order?orderNumber=${encodeURIComponent(
    order.orderNumber || '',
  )}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Confirmed - N's KI</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" maxWidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              
              <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
                <span style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; border-radius: 4px; margin-bottom: 8px;">PAYMENT VERIFIED</span>
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-family: Georgia, serif;">Order ${order.orderNumber} is Confirmed</h1>
              </td>

              <tr>
                <td style="padding: 32px 24px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">Good News, ${customerName}!</h2>
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    Your payment for order <strong>${order.orderNumber}</strong> has been verified. Our tailoring and fulfillment team is now processing your garments for dispatch.
                  </p>

                  <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #065f46; font-size: 13px; line-height: 1.5;">
                    ✓ <strong>Order Status:</strong> Confirmed & In Processing<br>
                    ✓ <strong>Total Paid:</strong> ${formatPKR(order.totalAmount || 0)}
                  </div>

                  <div style="text-align: center; margin-top: 28px;">
                    <a href="${trackingLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; text-decoration: none; border-radius: 6px;">
                      Track Order Live
                    </a>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b;">
                  © ${new Date().getFullYear()} N's KI. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
  4. ORDER SHIPPED EMAIL
 */
export function getOrderShippedCustomerEmailHtml(order: OrderData, siteUrl: string): string {
  const customerName = order.customer?.name || 'Valued Customer'
  const courierName = order.fulfillment?.courierName || 'Courier Service'
  const trackingNumber = order.fulfillment?.trackingNumber || 'N/A'
  const trackingUrl =
    order.fulfillment?.trackingUrl ||
    `${siteUrl.replace(/\/$/, '')}/track-order?orderNumber=${encodeURIComponent(
      order.orderNumber || '',
    )}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Dispatched - N's KI</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" maxWidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              
              <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
                <span style="display: inline-block; background-color: #8b5cf6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; border-radius: 4px; margin-bottom: 8px;">DISPATCHED</span>
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-family: Georgia, serif;">Your Parcel is on the Way!</h1>
              </td>

              <tr>
                <td style="padding: 32px 24px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">Hello ${customerName},</h2>
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    Your order <strong>${order.orderNumber}</strong> has been packed and handed over to courier for express delivery.
                  </p>

                  <!-- Courier Details Box -->
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                      <tr>
                        <td style="color: #64748b; padding-bottom: 6px;">Courier Service:</td>
                        <td style="color: #0f172a; font-weight: 700; text-align: right; padding-bottom: 6px;">${courierName}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding-bottom: 6px;">Consignment / Tracking #:</td>
                        <td style="color: #0f172a; font-weight: 700; text-align: right; padding-bottom: 6px; font-family: monospace; font-size: 14px;">${trackingNumber}</td>
                      </tr>
                    </table>
                  </div>

                  <div style="text-align: center; margin-top: 28px;">
                    <a href="${trackingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; text-decoration: none; border-radius: 6px;">
                      Track Package Online
                    </a>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b;">
                  © ${new Date().getFullYear()} N's KI. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
  5. ORDER REJECTED / CANCELLED EMAIL
 */
export function getOrderRejectedCustomerEmailHtml(order: OrderData, siteUrl: string): string {
  const customerName = order.customer?.name || 'Valued Customer'
  const reason =
    order.cancellationReason ||
    order.notes ||
    'Payment verification could not be completed or selected items are no longer available.'
  const shopUrl = `${siteUrl.replace(/\/$/, '')}/shop`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Cancelled - N's KI</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" maxWidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              
              <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
                <span style="display: inline-block; background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; border-radius: 4px; margin-bottom: 8px;">ORDER CANCELLED</span>
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-family: Georgia, serif;">Order ${order.orderNumber} Status Update</h1>
              </td>

              <tr>
                <td style="padding: 32px 24px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">Dear ${customerName},</h2>
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    We regret to inform you that your order <strong>${order.orderNumber}</strong> could not be processed and has been cancelled.
                  </p>

                  <!-- Rejection Reason Box -->
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 6px 0; font-size: 12px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Reason for Cancellation:</h3>
                    <p style="margin: 0; font-size: 14px; color: #7f1d1d; font-weight: 500; line-height: 1.5;">
                      ${reason}
                    </p>
                  </div>

                  <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                    If you believe this was an error or would like to submit updated payment proof, please contact our support team at <a href="mailto:info@nski.pk" style="color: #0f172a; font-weight: 600;">info@nski.pk</a>.
                  </p>

                  <div style="text-align: center; margin-top: 28px;">
                    <a href="${shopUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; text-decoration: none; border-radius: 6px;">
                      Return to Store
                    </a>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b;">
                  © ${new Date().getFullYear()} N's KI. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
