import { adminOnly } from '@/access/adminOnly'
import { compressVideoFile } from '@/utilities/compressVideo'
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
      async ({ data, req }) => {
        if (data?.mimeType?.startsWith('video/')) {
          data.prefix = 'videos'
          // Attempt video compression if file path is available on server
          if (req?.file?.tempFilePath) {
            const compressedPath = `${req.file.tempFilePath}-compressed.mp4`
            const result = await compressVideoFile(req.file.tempFilePath, compressedPath)
            if (result.success && result.outputPath) {
              req.file.tempFilePath = result.outputPath
            }
          }
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
    adminThumbnail: 'thumbnail',
    withMetadata: false, // Strips camera/EXIF metadata to reduce file size
    formatOptions: {
      format: 'webp',
      options: { quality: 85 },
    },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        formatOptions: {
          format: 'webp',
          options: { quality: 80 },
        },
        withoutEnlargement: true,
      },
      {
        name: 'card',
        width: 600,
        formatOptions: {
          format: 'webp',
          options: { quality: 82 },
        },
        withoutEnlargement: true,
      },
      {
        name: 'hero',
        width: 1600,
        formatOptions: {
          format: 'webp',
          options: { quality: 85 },
        },
        withoutEnlargement: true,
      },
    ],
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
