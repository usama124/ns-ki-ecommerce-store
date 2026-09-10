import type { CollectionConfig } from 'payload'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { adminOnly } from '@/access/adminOnly'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Unstitched']

function generateSKU(slug: string, size: string): string {
  const slugPart = (slug || 'PROD').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4).padEnd(4, 'X')
  const random = Math.random().toString(36).toUpperCase().slice(2, 5)
  return `LUJ-${slugPart}-${size.toUpperCase().slice(0, 2)}-${random}`
}

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Shop',
    defaultColumns: ['title', 'mainCategory', 'basePricePKR', 'status'],
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.variants && Array.isArray(data.variants)) {
          data.variants = data.variants.map((variant: any) => {
            if (!variant.sku) {
              variant.sku = generateSKU(data.slug || data.title || '', variant.size || 'OS')
            }
            return variant
          })
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            if (data?.title) {
              return data.title
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
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'mainCategory',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
      },
      filterOptions: () => ({
        type: { equals: 'main' },
      }),
    },
    {
      name: 'subCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
      filterOptions: () => ({
        type: { equals: 'subcategory' },
      }),
    },
    {
      name: 'basePricePKR',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        position: 'sidebar',
        description: 'Base price in Pakistani Rupees (PKR)',
        step: 50,
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => [
                  ...rootFeatures,
                  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                ],
              }),
            },
            {
              name: 'images',
              type: 'array',
              label: 'Product Images',
              minRows: 1,
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'alt',
                  type: 'text',
                },
              ],
            },
            {
              name: 'productVideo',
              type: 'upload',
              relationTo: 'media',
              label: 'Product Video (9:16 vertical MP4, optional)',
            },
          ],
        },
        {
          label: 'Variants & Stock',
          fields: [
            {
              name: 'variants',
              type: 'array',
              label: 'Variants (Size × Color)',
              admin: {
                description: 'Each row is a unique size + color combination. Add one row per combination (e.g. M / Navy Blue, M / Ivory, L / Ivory).',
              },
              fields: [
                {
                  name: 'size',
                  type: 'select',
                  required: true,
                  options: SIZES.map((s) => ({ label: s, value: s })),
                },
                {
                  name: 'color',
                  type: 'text',
                  label: 'Color Name',
                  admin: {
                    description: 'e.g. Ivory, Navy Blue, Emerald Green, Dusty Rose',
                    placeholder: 'e.g. Ivory',
                  },
                },
                {
                  name: 'colorHex',
                  type: 'text',
                  label: 'Color Hex (for swatch display)',
                  admin: {
                    description: 'e.g. #FFFFF0 — leave blank to auto-generate a swatch.',
                    placeholder: '#FFFFF0',
                  },
                },
                {
                  name: 'sku',
                  type: 'text',
                  label: 'SKU (auto-generated if blank)',
                  admin: {
                    description: 'Format: LUJ-XXXX-SZ-XXX. Leave blank to auto-generate.',
                  },
                },
                {
                  name: 'stock',
                  type: 'number',
                  required: true,
                  defaultValue: 10,
                  min: 0,
                },
                {
                  name: 'allowBackorder',
                  type: 'checkbox',
                  defaultValue: false,
                  label: 'Allow Backorder (Purchase even if out of stock)',
                },
                {
                  name: 'pricePKR',
                  type: 'number',
                  label: 'Price Override (PKR)',
                  admin: {
                    description: 'Leave blank to use the base price.',
                  },
                  min: 0,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
