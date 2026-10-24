import { adminOnly } from '@/access/adminOnly'
import { assertProductUnreserved } from '@/utilities/reservedProductGuard'
import {
    FixedToolbarFeature,
    HeadingFeature,
    HorizontalRuleFeature,
    InlineToolbarFeature,
    lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { CollectionConfig } from 'payload'

// Sizes and Colors are now managed via the Sizes & Colors admin collections.
// Product variants reference those collections via relationship fields.

function generateSKU(slug: string, size: string): string {
  const slugPart = (slug || 'PROD')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X')
  const random = Math.random().toString(36).toUpperCase().slice(2, 5)
  return `NKI-${slugPart}-${size.toUpperCase().slice(0, 2)}-${random}`
}

import {
  autoSyncShoppableVideo,
  removeShoppableVideoOnDelete,
} from './hooks/autoSyncShoppableVideo'

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: ({ req: { user } }) => user?.roles?.includes('admin') ? true : { status: { equals: 'published' } },
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Shop',
    defaultColumns: ['title', 'primaryCategory', 'basePricePKR', 'status'],
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (originalDoc && Array.isArray(data?.variants)) {
          const kept = new Set(data.variants.map((variant: { id?: string }) => String(variant.id)))
          if (originalDoc.variants?.some((variant: { id?: string }) => !kept.has(String(variant.id)))) await assertProductUnreserved(originalDoc.id, req)
        }
        if (data?.variants && Array.isArray(data.variants)) {
          data.variants = data.variants.map((variant: any) => {
            // size is now a relationship — could be populated object { id, name } or just an ID number
            const sizeVal = variant.size
            const sizeName =
              typeof sizeVal === 'object' && sizeVal !== null ? (sizeVal.name ?? 'OS') : 'OS'
            if (!variant.sku) {
              variant.sku = generateSKU(data.slug || data.title || '', sizeName)
            }
            return variant
          })
        }
        return data
      },
    ],
    afterChange: [autoSyncShoppableVideo],
    beforeDelete: [async ({ id, req }) => { await assertProductUnreserved(id, req) }],
    afterDelete: [removeShoppableVideoOnDelete],
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
      name: 'primaryCategory',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      hasMany: false,
      label: 'Primary Category',
      admin: {
        position: 'sidebar',
        description:
          'Primary category used for canonical URLs, main breadcrumb hierarchy, and primary grouping.',
      },
      filterOptions: () => ({
        type: { equals: 'main' },
      }),
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      hasMany: true,
      label: 'Assigned Categories & Collections',
      admin: {
        position: 'sidebar',
        description:
          "Select all main categories, subcategories, or seasonal collections (e.g. Unstitched, Luxury Lawn '25, Sale) where this product should appear.",
      },
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
      name: 'color',
      type: 'text',
      label: 'Garment Color',
      admin: {
        position: 'sidebar',
        description: 'Fixed color of this garment (e.g. Emerald Green, Ivory Gold)',
        placeholder: 'e.g. Emerald Green',
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
            {
              name: 'showInShopByVideo',
              type: 'checkbox',
              label: 'Show video in homepage Shop by Video',
              defaultValue: false,
              admin: {
                description: 'Opt in explicitly to feature this product video on the homepage. Leave off to keep the video on the product page only.',
              },
            },
          ],
        },
        {
          label: 'Size Variants & Stock',
          fields: [
            {
              name: 'variants',
              type: 'array',
              label: 'Product Size Variants',
              admin: {
                description:
                  'Add sizes for this product here. Click "Add Variant" to create a unique size variant with stock count and price overrides.',
              },
              fields: [
                {
                  name: 'size',
                  type: 'relationship',
                  relationTo: 'sizes',
                  required: true,
                  label: 'Size',
                  admin: {
                    description: 'Select a size. Go to Shop → Sizes to add new sizes.',
                  },
                },
                {
                  name: 'sku',
                  type: 'text',
                  label: 'SKU (auto-generated if blank)',
                  admin: {
                    description: 'Format: NKI-XXXX-SZ-XXX. Leave blank to auto-generate.',
                  },
                },
                {
                  name: 'stock',
                  type: 'number',
                  // A stale product editor must not overwrite stock sold since
                  // the form opened. Existing-stock writes use Inventory only.
                  access: { update: ({ req }) => req.context?.commerceInventoryWrite === true },
                  admin: { description: 'Set initial stock here. To adjust existing stock, use the Inventory dashboard.' },
                  required: true,
                  defaultValue: 10,
                  min: 0,
                  label: 'Stock Quantity',
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
                    description: 'Leave blank to use the product base price.',
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
