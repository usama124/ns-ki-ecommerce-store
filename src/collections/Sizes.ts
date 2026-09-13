import { adminOnly } from '@/access/adminOnly'
import type { CollectionConfig } from 'payload'

export const Sizes: CollectionConfig = {
  slug: 'sizes',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Shop',
    defaultColumns: ['name', 'sortOrder'],
    description: 'Manage available sizes for product variants. Add new sizes here to make them available in product listings.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'e.g. XS, S, M, L, XL, XXL, Unstitched, Free Size',
        placeholder: 'e.g. XL',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 100,
      admin: {
        description: 'Lower numbers appear first in dropdowns (0 = first).',
        step: 10,
      },
    },
  ],
  timestamps: true,
}
