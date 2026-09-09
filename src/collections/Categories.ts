import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Shop',
    defaultColumns: ['name', 'type', 'parent', 'isFixed'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: false,
        description: 'Auto-generated from name. You can override.',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            if (data?.name) {
              return data.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'main',
      options: [
        { label: 'Main Category', value: 'main' },
        { label: 'Subcategory / Collection', value: 'subcategory' },
      ],
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        condition: (data) => data?.type === 'subcategory',
        description: 'Select the main category this belongs to.',
      },
      filterOptions: () => ({
        type: { equals: 'main' },
      }),
    },
    {
      name: 'isFixed',
      type: 'checkbox',
      defaultValue: true,
      label: 'Fixed Core Category',
      admin: {
        description: 'Core categories (Unstitched, Ready to Wear, etc.) should be fixed.',
      },
    },
    {
      name: 'description',
      type: 'text',
    },
  ],
  timestamps: true,
}
