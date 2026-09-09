import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Shop',
    defaultColumns: ['orderNumber', 'customer', 'totalAmount', 'paymentMethod', 'status', 'createdAt'],
  },
  access: {
    // Anyone can create orders (guest checkout)
    create: () => true,
    // Only admins can read/update/delete
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (value) return value
            const num = Math.floor(1001 + Math.random() * 8999)
            return `#LUJ-${num}`
          },
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending_verification',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Pending Verification', value: 'pending_verification' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Processing', value: 'processing' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'paymentMethod',
      type: 'select',
      required: true,
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Cash on Delivery (COD)', value: 'cod' },
        { label: 'Bank / Raast Transfer', value: 'bank_transfer' },
        { label: 'JazzCash', value: 'jazzcash' },
        { label: 'EasyPaisa', value: 'easypaisa' },
      ],
    },
    {
      name: 'customer',
      type: 'group',
      label: 'Customer Information',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Full Name',
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email Address',
        },
        {
          name: 'phone',
          type: 'text',
          required: true,
          label: 'Phone Number (+92)',
        },
        {
          name: 'city',
          type: 'text',
          required: true,
        },
        {
          name: 'province',
          type: 'text',
          required: true,
        },
        {
          name: 'address',
          type: 'textarea',
          required: true,
          label: 'Street Address',
        },
      ],
    },
    {
      name: 'paymentProof',
      type: 'group',
      label: 'Payment Proof (Digital Payments)',
      admin: {
        condition: (data) => data?.paymentMethod !== 'cod',
      },
      fields: [
        {
          name: 'transactionId',
          type: 'text',
          label: 'Transaction / Reference ID (TRX ID)',
        },
        {
          name: 'screenshot',
          type: 'upload',
          relationTo: 'media',
          label: 'Payment Proof Screenshot',
        },
      ],
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      label: 'Order Items',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'variantSize',
          type: 'text',
          required: true,
          label: 'Size',
        },
        {
          name: 'variantSku',
          type: 'text',
          label: 'SKU',
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          label: 'Unit Price (PKR)',
        },
      ],
    },
    {
      name: 'subtotal',
      type: 'number',
      required: true,
      label: 'Subtotal (PKR)',
    },
    {
      name: 'shippingFee',
      type: 'number',
      required: true,
      label: 'Shipping Fee (PKR)',
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      label: 'Total Amount (PKR)',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Order Notes (Admin)',
    },
  ],
  timestamps: true,
}
