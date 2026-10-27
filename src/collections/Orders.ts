import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { orderOwner } from '@/access/orderOwner'
import { reconcileOrderInventory, recordInventoryMovement } from '@/utilities/orderInventory'
import { enqueueOrderEmails } from '@/utilities/orderOutbox'
import { enqueueOrderAnalytics } from '@/utilities/orderAnalytics'
import { recordOrderHistory } from '@/utilities/operationsHistory'
import { guardMoneyOrder } from '@/utilities/paymentLedger'
import { RequestError } from '@/utilities/apiSecurity'
import { requireCommerceReady } from '@/utilities/commerceDatabase'
import { orderAmounts } from '@/utilities/orderAmounts'
import { validateOrderPaymentMethod } from '@/utilities/validateOrderPaymentMethod'
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
    // Guest checkout uses the validated server command, never generic GraphQL create.
    create: adminOnly,
    read: orderOwner,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeValidate: [
      validateOrderPaymentMethod,
      async ({ data, req, originalDoc }) => {
        if (!data) return data

        // Supply derived required fields before Payload validates an admin-created
        // order; read-only subtotal/total inputs must never need manual entry.
        if (!originalDoc || ['items', 'shippingFee', 'codFee', 'paymentMethod', 'subtotal', 'totalAmount'].some(key => Object.hasOwn(data, key))) {
          Object.assign(data, orderAmounts(data, originalDoc))
        }

        const paymentMethod = data.paymentMethod || originalDoc?.paymentMethod
        const isDigital = paymentMethod && paymentMethod !== 'cod'

        // Extract raw trxId from data.trxId OR data.paymentProof?.transactionId
        const rawTrxId = data.trxId || data.paymentProof?.transactionId

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
          const todayDate = new Date(originalDoc?.createdAt || Date.now()).toISOString().slice(0, 10)
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
              pagination: false,
              overrideAccess: true,
              req,
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
                req,
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
              pagination: false,
              overrideAccess: true,
              req,
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
        await requireCommerceReady(req.payload)
        if (operation === 'create') {
          // COD orders are auto-confirmed by default; digital payments require verification
          if (data?.paymentMethod === 'cod' && !data.status) {
            data.status = 'confirmed'
          } else if (!data?.status) {
            data.status = 'pending_verification'
          }

        }
        // Derive totals before inventory writes in the same transaction. Status-only
        // updates preserve historical amounts; explicit edits use accepted price/fee snapshots.
        if (operation === 'create' || ['items', 'shippingFee', 'codFee', 'paymentMethod', 'subtotal', 'totalAmount'].some(key => Object.hasOwn(data, key))) {
          Object.assign(data, orderAmounts(data, originalDoc))
        }
        if (operation !== 'create' && originalDoc) await guardMoneyOrder(originalDoc, data, req)
        // Never accept a supplied allocation ledger from REST/GraphQL/admin forms.
        data.inventoryState = await reconcileOrderInventory(data, operation === 'create' ? undefined : originalDoc, req)
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        await recordInventoryMovement(doc, previousDoc, req)
        await recordOrderHistory(doc, previousDoc, operation, req)
        await enqueueOrderEmails(doc, previousDoc, operation, req)
        await enqueueOrderAnalytics(doc, previousDoc, operation, req)
      },
    ],
    beforeDelete: [async ({ id, req }) => {
      const order = await req.payload.findByID({ collection: 'orders', id, depth: 0, req, overrideAccess: true })
      if (order.status !== 'cancelled') throw new RequestError('Cancel and reconcile the order before deleting it.', 409)
      await guardMoneyOrder(order, null, req)
      await recordOrderHistory(order, order, 'update', req, true)
    }],
  },
  fields: [
    {
      name: 'inventoryState', type: 'json',
      access: { create: () => false, update: () => false, read: adminOnlyFieldAccess },
      admin: { readOnly: true, description: 'System-owned stock allocations. Legacy orders require manual reconciliation before cancellation or item edits.' },
    },
    {
      name: 'customerAccount',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
      access: { create: adminOnlyFieldAccess, update: () => false },
    },
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
      access: { read: adminOnlyFieldAccess },
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
          access: { create: () => false, update: () => false },
          admin: { readOnly: true, description: 'Legacy public-media receipts only. New receipts are stored separately in the private bucket.' },
        },
        {
          name: 'privateReceipt',
          type: 'ui',
          admin: { components: { Field: '@/components/admin/OrderReceipt#OrderReceipt' } },
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
          max: 99,
          validate: (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 99 || 'Quantity must be a whole number between 1 and 99.',
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
      admin: { readOnly: true, description: 'Calculated from order item quantities and accepted unit prices.' },
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
      admin: { readOnly: true, description: 'Calculated from subtotal, shipping and COD fees.' },
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
      access: { read: adminOnlyFieldAccess },
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      access: { read: adminOnlyFieldAccess },
      label: 'Order Notes (Admin)',
    },
  ],
  timestamps: true,
}
