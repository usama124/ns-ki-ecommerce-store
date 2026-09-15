import { adminOnly } from '@/access/adminOnly'
import {
    FixedToolbarFeature,
    InlineToolbarFeature,
    lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import type { CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
  },
  access: {
    // Allow public uploads for payment proof screenshots & product media
    create: () => true,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.mimeType?.startsWith('video/')) {
          data.prefix = 'videos'
        } else if (data?.mimeType?.startsWith('image/')) {
          data.prefix = 'images'
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
    ],
  },
}
