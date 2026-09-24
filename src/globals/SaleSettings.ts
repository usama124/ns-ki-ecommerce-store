import type { GlobalConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const SaleSettings: GlobalConfig = {
  slug: 'sale-settings',
  label: 'Flash Sale Settings',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Shop',
  },
  hooks: {
    beforeChange: [
      async ({ data }) => {
        // Enforce date bounds if active
        if (data?.isActive) {
          if (data.startDate && data.endDate) {
            const start = new Date(data.startDate).getTime()
            const end = new Date(data.endDate).getTime()
            if (end <= start) {
              throw new Error('Sale End Date must be after Start Date.')
            }
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'Is Flash Sale Active',
      defaultValue: false,
      admin: {
        description:
          'When enabled, products in targeted categories will display the computed sale discount across the store.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Sale Campaign Title',
      defaultValue: 'Flash Sale',
      admin: {
        description: 'e.g., Mid-Summer Clearance, Blessed Friday Sale',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      label: 'Sale Start Datetime',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Exact date and time when the sale starts.',
      },
    },
    {
      name: 'endDate',
      type: 'date',
      label: 'Sale End Datetime',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'Exact date and time when the sale automatically concludes.',
      },
    },
    {
      name: 'discountPercentage',
      type: 'number',
      label: 'Discount Percentage (%)',
      defaultValue: 20,
      min: 1,
      max: 99,
      admin: {
        description:
          'Percentage discount (1–99%) applied uniformly to all products in targeted categories.',
      },
    },
    {
      name: 'targetedCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Targeted Categories & Subcategories',
      admin: {
        description: 'Select main categories or subcategories eligible for this flash sale.',
      },
    },
    {
      name: 'announcementText',
      type: 'textarea',
      label: 'Storefront Announcement Alert Text',
      defaultValue: '🔥 FLASH SALE LIVE! Enjoy up to 20% OFF on selected collections.',
      admin: {
        description: 'Text displayed on the storefront alert banner / popup modal.',
      },
    },
    {
      name: 'enablePopup',
      type: 'checkbox',
      label: 'Enable Storefront Announcement Alert',
      defaultValue: true,
      admin: {
        description: 'Show announcement popup banner to site visitors when sale is active.',
      },
    },
  ],
}

