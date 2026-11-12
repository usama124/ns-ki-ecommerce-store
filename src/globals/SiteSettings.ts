import { adminOnly } from '@/access/adminOnly'
import type { GlobalConfig, UploadField } from 'payload'
import { revalidateSiteSettings } from '@/hooks/revalidateSiteSettings'

const paymentQRField = (): UploadField => ({
  name: 'qrCode',
  label: 'Payment QR Code (optional)',
  type: 'upload',
  relationTo: 'media',
  filterOptions: { mimeType: { in: ['image/png', 'image/jpeg', 'image/webp'] } },
  admin: { description: 'Upload the actual merchant QR supplied by your bank/wallet (PNG, JPEG or WebP). Keep the entire QR and white border; do not crop it. Publicly visible at checkout. Test scanning it before enabling payments.' },
})

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
  hooks: { afterChange: [revalidateSiteSettings] },
  fields: [
    {
      name: 'paymentMethods',
      type: 'group',
      label: 'Enabled Payment Methods',
      admin: { description: 'Enable methods offered for new orders. Turning every method off pauses checkout. Existing orders are not changed. Account details are configured below.' },
      fields: [
        { name: 'cod', type: 'checkbox', label: 'Enable Cash on Delivery (COD)', defaultValue: false },
        { name: 'bank_transfer', type: 'checkbox', label: 'Enable Bank / Raast Transfer', defaultValue: true },
        { name: 'jazzcash', type: 'checkbox', label: 'Enable JazzCash', defaultValue: false },
        { name: 'easypaisa', type: 'checkbox', label: 'Enable EasyPaisa', defaultValue: true },
      ],
    },
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
          defaultValue: 'NATIONWIDE SHIPPING — RS. 250 FLAT RATE',
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
          name: 'flatShippingFee',
          type: 'number',
          min: 0,
          max: 1000000,
          defaultValue: 250,
          label: 'Flat Shipping Fee — All Cities (PKR)',
          validate: (value: unknown) => value == null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1000000) || 'Enter a whole-rupee amount between 0 and 1,000,000.',
          admin: { description: 'The same shipping charge applies nationwide. Existing orders retain their recorded charges. COD handling is separate.' },
        },
        {
          name: 'freeShippingEnabled',
          type: 'checkbox',
          defaultValue: false,
          label: 'Enable Free Shipping Above Threshold',
          admin: { description: 'Off by default so the flat charge applies to all order sizes.' },
        },
        {
          name: 'freeShippingThreshold',
          type: 'number',
          min: 0,
          defaultValue: 15000,
          label: 'Free Shipping Threshold (PKR)',
          admin: { condition: data => data?.shipping?.freeShippingEnabled === true },
        },
        {
          name: 'majorCityFee',
          type: 'number',
          defaultValue: 250,
          label: 'Major City Shipping Fee (PKR)',
          admin: { hidden: true },
        },
        {
          name: 'secondaryCityFee',
          type: 'number',
          defaultValue: 350,
          label: 'Secondary City Shipping Fee (PKR)',
          admin: { hidden: true },
        },
        {
          name: 'codFee',
          type: 'number',
          min: 0,
          defaultValue: 250,
          label: 'Cash on Delivery (COD) Charges (PKR)',
          admin: {
            description:
              'Extra charges applied when customer selects Cash on Delivery. Set to 0 for free COD.',
          },
        },
        {
          name: 'majorCities',
          type: 'array',
          label: 'Major Cities',
          admin: {
            hidden: true,
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
            paymentQRField(),
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
            paymentQRField(),
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
            paymentQRField(),
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
