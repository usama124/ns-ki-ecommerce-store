import { describe, expect, it } from 'vitest'
import {
  getNewOrderAdminAlertEmailHtml,
  getOrderPlacedCustomerEmailHtml,
  getOrderRejectedCustomerEmailHtml,
  getOrderShippedCustomerEmailHtml,
  getPaymentConfirmedCustomerEmailHtml,
} from '../../src/utilities/emailTemplates'

describe('Order Email Templates & Generation', () => {
  const sampleOrder = {
    id: '650000000000000000000001',
    orderNumber: '#NKI-889900',
    status: 'pending_verification',
    paymentMethod: 'cod',
    customer: {
      name: 'Fatima Khan',
      email: 'fatima@example.com',
      phone: '03001234567',
      city: 'Lahore',
      province: 'Punjab',
      address: 'House 42, Block C, Gulberg III',
    },
    items: [
      {
        product: { title: 'Zarah Velvet Chiffon' },
        variantSize: 'M',
        variantColor: 'Emerald Green',
        quantity: 2,
        unitPrice: 12000,
      },
    ],
    subtotal: 24000,
    shippingFee: 250,
    codFee: 100,
    totalAmount: 24350,
    fulfillment: {
      courierName: 'TCS',
      trackingNumber: 'TCS-99887766',
      trackingUrl: 'https://tcsexpress.com/track/TCS-99887766',
    },
  }

  it('generates customer order placed email HTML correctly', () => {
    const html = getOrderPlacedCustomerEmailHtml(sampleOrder, 'http://localhost:3000')

    expect(html).toContain('Fatima Khan')
    expect(html).toContain('#NKI-889900')
    expect(html).toContain('Zarah Velvet Chiffon')
    expect(html).toContain('Cash on Delivery (COD)')
    expect(html).toContain('Rs. 24,350')
    expect(html).toContain('/track-order?orderNumber=%23NKI-889900')
  })

  it('generates new order admin alert email HTML correctly', () => {
    const html = getNewOrderAdminAlertEmailHtml(sampleOrder, 'http://localhost:3000')

    expect(html).toContain('#NKI-889900')
    expect(html).toContain('Fatima Khan')
    expect(html).toContain('Rs. 24,350')
    expect(html).toContain('/admin/orders-dashboard')
  })

  it('generates payment confirmed customer email HTML correctly', () => {
    const html = getPaymentConfirmedCustomerEmailHtml(sampleOrder, 'http://localhost:3000')

    expect(html).toContain('PAYMENT VERIFIED')
    expect(html).toContain('Fatima Khan')
    expect(html).toContain('#NKI-889900')
    expect(html).toContain('Rs. 24,350')
  })

  it('generates order shipped customer email HTML correctly', () => {
    const html = getOrderShippedCustomerEmailHtml(sampleOrder, 'http://localhost:3000')

    expect(html).toContain('DISPATCHED')
    expect(html).toContain('Fatima Khan')
    expect(html).toContain('#NKI-889900')
    expect(html).toContain('TCS')
    expect(html).toContain('TCS-99887766')
    expect(html).toContain('https://tcsexpress.com/track/TCS-99887766')
  })

  it('generates order rejected / cancelled customer email HTML correctly', () => {
    const rejectedOrder = {
      ...sampleOrder,
      status: 'cancelled',
      cancellationReason: 'Payment transaction ID could not be verified with bank records.',
    }
    const html = getOrderRejectedCustomerEmailHtml(rejectedOrder, 'http://localhost:3000')

    expect(html).toContain('ORDER CANCELLED')
    expect(html).toContain('Fatima Khan')
    expect(html).toContain('#NKI-889900')
    expect(html).toContain('Payment transaction ID could not be verified with bank records.')
  })
})
