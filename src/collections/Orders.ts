import { adminOnly } from '@/access/adminOnly'
import { restoreOrderStock, validateAndDeductStock } from '@/utilities/inventory'
import {
    sendAdminOrderPlacedAlert,
    sendCustomerOrderConfirmedEmail,
    sendStatusUpdateEmail,
} from '@/utilities/sendOrderEmails'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Shop',
    defaultColumns: [
      'orderNumber',
      'customer',
      'totalAmount',
      'paymentMethod',
      'status',
      'createdAt',
    ],
  },
  access: {
    // Anyone can create orders (guest checkout)
    create: () => true,
    // Only admins can read/update/delete
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!data) return data

        const paymentMethod = data.paymentMethod || originalDoc?.paymentMethod
        const isDigital = paymentMethod && paymentMethod !== 'cod'

        // Extract raw trxId from data.trxId OR data.paymentProof?.transactionId
        let rawTrxId = data.trxId || data.paymentProof?.transactionId

        if (isDigital && rawTrxId) {
          // 1. Sanitize input: Strip whitespace, dashes, special characters, convert to UPPERCASE
          const cleanTrxId = String(rawTrxId).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

          // Validate length (between 6 and 18)
          if (cleanTrxId.length < 6 || cleanTrxId.length > 18) {
            throw new ValidationError({
              errors: [
                {
                  message: 'Transaction Reference / STAN ID must be between 6 and 18 alphanumeric characters.',
                  path: 'paymentProof.transactionId',
                },
              ],
            })
          }

          // Set clean sanitized TRX ID on data
          data.trxId = cleanTrxId
          if (data.paymentProof) {
            data.paymentProof.transactionId = cleanTrxId
          } else {
            data.paymentProof = { transactionId: cleanTrxId }
          }

          // 2. Compute compositeTrxKey
          const todayDate = new Date().toISOString().slice(0, 10)
          const compositeTrxKey = `${paymentMethod}-${todayDate}-${cleanTrxId}`
          data.compositeTrxKey = compositeTrxKey

          // 3. Validate Uniqueness of compositeTrxKey across Payload DB
          if (req?.payload) {
            const existingComposite = await req.payload.find({
              collection: 'orders',
              where: {
                compositeTrxKey: { equals: compositeTrxKey },
                ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
              },
              limit: 1,
              overrideAccess: true,
            })

            if (existingComposite.docs.length > 0) {
              throw new ValidationError({
                errors: [
                  {
                    message: 'This Transaction Reference / STAN ID has already been submitted for an order today. Please verify your receipt.',
                    path: 'paymentProof.transactionId',
                  },
                ],
              })
            }
          }
        }

        // 4. Image File SHA-256 Hash Check
        const screenshotId = data.paymentProof?.screenshot || data.screenshot
        if (isDigital && screenshotId && req?.payload) {
          let imageHash = data.paymentProofHash
          const mediaId = typeof screenshotId === 'object' ? screenshotId.id : screenshotId

          if (mediaId) {
            try {
              const mediaDoc: any = await req.payload.findByID({
                collection: 'media',
                id: mediaId,
                overrideAccess: true,
              })

              if (mediaDoc) {
                if (mediaDoc.fileHash) {
                  imageHash = mediaDoc.fileHash
                } else if (mediaDoc.filename) {
                  const filePath = path.resolve(process.cwd(), 'public/media', mediaDoc.filename)
                  if (fs.existsSync(filePath)) {
                    const buf = fs.readFileSync(filePath)
                    imageHash = crypto.createHash('sha256').update(buf).digest('hex')
                  }
                }
              }
            } catch (err) {
              console.warn('[Orders Hook] Could not inspect media hash:', err)
            }
          }

          if (imageHash) {
            data.paymentProofHash = imageHash

            const existingHash = await req.payload.find({
              collection: 'orders',
              where: {
                paymentProofHash: { equals: imageHash },
                ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
              },
              limit: 1,
              overrideAccess: true,
            })

            if (existingHash.docs.length > 0) {
              throw new ValidationError({
                errors: [
                  {
                    message: 'This payment receipt image has already been uploaded for another order.',
                    path: 'paymentProof.screenshot',
                  },
                ],
              })
            }
          }
        }

        return data
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (req.context?.skipStockHook) return data

        if (operation === 'create') {
          // COD orders are auto-confirmed by default; digital payments require verification
          if (data?.paymentMethod === 'cod') {
            data.status = 'confirmed'
          } else if (!data?.status) {
            data.status = 'pending_verification'
          }

          if (data?.items && Array.isArray(data.items)) {
            await validateAndDeductStock({ items: data.items, req })
          }
        } else if (operation === 'update') {
          const oldStatus = originalDoc?.status
          const newStatus = data?.status

          // Status changed from active -> cancelled: restore stock
          if (oldStatus && oldStatus !== 'cancelled' && newStatus === 'cancelled') {
            const items = data?.items || originalDoc?.items
            if (items && Array.isArray(items)) {
              await restoreOrderStock({ items, req })
            }
          }

          // Status changed from cancelled -> active: re-deduct stock
          if (oldStatus === 'cancelled' && newStatus && newStatus !== 'cancelled') {
            const items = data?.items || originalDoc?.items
            if (items && Array.isArray(items)) {
              await validateAndDeductStock({ items, req })
            }
          }
        }

        return data
      },
    ],
    afterChange: [
      ({ doc, previousDoc, operation }) => {
        if (operation === 'create') {
          // Send instant alert email to store admin on every order creation
          void sendAdminOrderPlacedAlert(doc).catch((err) => {
            console.warn('[Orders] Background admin alert dispatch error:', err)
          })

          // COD orders are auto-confirmed at creation; send customer confirmation email immediately
          if (doc.status === 'confirmed') {
            void sendCustomerOrderConfirmedEmail(doc).catch((err) => {
              console.warn('[Orders] Background customer confirmation error:', err)
            })
          }
        } else if (operation === 'update') {
          void sendStatusUpdateEmail(doc, previousDoc?.status).catch((err) => {
            console.warn('[Orders] Background status email dispatch error:', err)
          })
        }
      },
    ],
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
            const num = Math.floor(100000 + Math.random() * 899999)
            return `#NKI-${num}`
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
      name: 'fulfillment',
      type: 'group',
      label: 'Fulfillment & Courier Tracking',
      admin: {
        condition: (data) => data?.status === 'shipped' || data?.status === 'delivered',
      },
      fields: [
        {
          name: 'courierName',
          type: 'select',
          label: 'Courier Service',
          options: [
            { label: 'TCS Express', value: 'TCS' },
            { label: 'Leopard Courier', value: 'Leopard' },
            { label: 'CallCourier', value: 'CallCourier' },
            { label: 'Trax Logistics', value: 'Trax' },
            { label: 'M&P Courier', value: 'M&P' },
            { label: 'PostEx', value: 'PostEx' },
            { label: 'Other / Rider Delivery', value: 'Other' },
          ],
        },
        {
          name: 'trackingNumber',
          type: 'text',
          label: 'Courier Tracking / Consignment Number',
        },
        {
          name: 'trackingUrl',
          type: 'text',
          label: 'Direct Courier Tracking URL (Optional)',
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
          name: 'variantColor',
          type: 'text',
          label: 'Color',
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
      name: 'codFee',
      type: 'number',
      defaultValue: 0,
      label: 'COD Fee (PKR)',
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      label: 'Total Amount (PKR)',
    },
    {
      name: 'cancellationReason',
      type: 'textarea',
      label: 'Cancellation / Rejection Reason',
      admin: {
        condition: (data) => data?.status === 'cancelled',
        description:
          'Provide a reason to inform the customer why their order was rejected/cancelled.',
      },
    },
    {
      name: 'trxId',
      type: 'text',
      admin: {
        description: 'Sanitized 6-18 character Transaction / STAN Reference ID',
        position: 'sidebar',
      },
    },
    {
      name: 'compositeTrxKey',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'paymentProofHash',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Order Notes (Admin)',
    },
  ],
  timestamps: true,
}
