import { adminOnly } from '@/access/adminOnly'
import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Settings',
  },
  label: 'Site Settings',
  fields: [
    {
      name: 'announcementBar',
      type: 'group',
      label: 'Announcement Bar',
      fields: [
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          label: 'Show Announcement Bar',
        },
        {
          name: 'text',
          type: 'text',
          defaultValue: 'FREE EXPRESS SHIPPING ACROSS PAKISTAN ON ORDERS ABOVE RS. 15,000',
          label: 'Announcement Text',
        },
        {
          name: 'link',
          type: 'text',
          label: 'Announcement Link (optional)',
        },
      ],
    },
    {
      name: 'shipping',
      type: 'group',
      label: 'Shipping Configuration',
      fields: [
        {
          name: 'freeShippingThreshold',
          type: 'number',
          defaultValue: 15000,
          label: 'Free Shipping Threshold (PKR)',
        },
        {
          name: 'majorCityFee',
          type: 'number',
          defaultValue: 250,
          label: 'Major City Shipping Fee (PKR)',
        },
        {
          name: 'secondaryCityFee',
          type: 'number',
          defaultValue: 350,
          label: 'Secondary City Shipping Fee (PKR)',
        },
        {
          name: 'majorCities',
          type: 'array',
          label: 'Major Cities',
          admin: {
            description: 'Cities that qualify for the lower shipping rate.',
          },
          fields: [
            {
              name: 'city',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: 'paymentDetails',
      type: 'group',
      label: 'Payment Account Details',
      admin: {
        description: 'These details are shown to customers on the checkout page.',
      },
      fields: [
        {
          name: 'bankTransfer',
          type: 'group',
          label: 'Bank / Raast Transfer',
          fields: [
            { name: 'bankName', type: 'text', label: 'Bank Name', defaultValue: 'Meezan Bank' },
            {
              name: 'accountTitle',
              type: 'text',
              label: 'Account Title',
              defaultValue: "N's KI LUXURY FASHION",
            },
            {
              name: 'accountNumber',
              type: 'text',
              label: 'Account Number / IBAN',
              defaultValue: 'PK00MEZN0001020304050607',
            },
            {
              name: 'raastId',
              type: 'text',
              label: 'Raast ID (optional)',
              defaultValue: '03001234567',
            },
          ],
        },
        {
          name: 'jazzcash',
          type: 'group',
          label: 'JazzCash',
          fields: [
            {
              name: 'mobileNumber',
              type: 'text',
              label: 'JazzCash Mobile Number',
              defaultValue: '03001234567',
            },
            {
              name: 'accountName',
              type: 'text',
              label: 'Account Name',
              defaultValue: "N's KI CLOTHING",
            },
          ],
        },
        {
          name: 'easypaisa',
          type: 'group',
          label: 'EasyPaisa',
          fields: [
            {
              name: 'mobileNumber',
              type: 'text',
              label: 'EasyPaisa Mobile Number',
              defaultValue: '03001234567',
            },
            {
              name: 'accountName',
              type: 'text',
              label: 'Account Name',
              defaultValue: "N's KI CLOTHING",
            },
          ],
        },
      ],
    },
  ],
}
