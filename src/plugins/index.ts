import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { Plugin } from 'payload'

import { isAdmin } from '@/access/isAdmin'
import { getServerSideURL } from '@/utilities/getURL'

type DocWithTitle = { title?: string; slug?: string }

const generateTitle: GenerateTitle<DocWithTitle> = ({ doc }) => {
  return doc?.title ? `${doc.title} | N's KI` : "N's KI — Pakistani Luxury Fashion"
}

const generateURL: GenerateURL<DocWithTitle> = ({ doc }) => {
  const url = getServerSideURL()
  return doc?.slug ? `${url}/${doc.slug}` : url
}

import { s3Storage } from '@payloadcms/storage-s3'

const r2Bucket = process.env.R2_BUCKET || ''
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || ''
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
const r2Endpoint = process.env.R2_ENDPOINT || ''
const r2PublicDomain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '')

const isR2Configured = Boolean(r2Bucket && r2AccessKeyId && r2SecretAccessKey && r2Endpoint)

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ...(isR2Configured
    ? [
        (async (incomingConfig) => {
          const s3Plugin = s3Storage({
            collections: {
              media: {
                // prefix: '' must be defined so the cloud-storage plugin
                // injects the `prefix` field into the Media schema.
                prefix: '',
                disableLocalStorage: true,
                ...(r2PublicDomain
                  ? {
                      generateFileURL: ({ filename, prefix }) => {
                        const cleanPrefix = prefix ? `${prefix.replace(/\/$/, '')}/` : ''
                        return `${r2PublicDomain}/${cleanPrefix}${filename}`
                      },
                    }
                  : {}),
              },
            },
            // clientUploads: browser requests a pre-signed R2 URL and uploads the file directly,
            // bypassing the Next.js server entirely (essential for Vercel 4.5 MB limit).
            clientUploads: true,
            bucket: r2Bucket,
            config: {
              credentials: {
                accessKeyId: r2AccessKeyId,
                secretAccessKey: r2SecretAccessKey,
              },
              region: 'auto',
              endpoint: r2Endpoint,
              forcePathStyle: true,
            },
          })

          const config = await s3Plugin(incomingConfig)

          // Intercept /storage-s3-generate-signed-url endpoint to dynamically supply docPrefix ('videos' | 'images')
          // based on mimeType when clientUploads requests pre-signed URLs.
          if (config.endpoints) {
            const signedUrlEndpoint = config.endpoints.find(
              (e) => e.path?.startsWith('/storage-s3-generate-signed-url') && e.method === 'post',
            )
            if (signedUrlEndpoint) {
              const originalHandler = signedUrlEndpoint.handler
              signedUrlEndpoint.handler = async (req: any) => {
                try {
                  const body = await req.json?.()
                  if (body && !body.docPrefix && body.mimeType) {
                    if (body.mimeType.startsWith('video/')) {
                      body.docPrefix = 'videos'
                    } else if (body.mimeType.startsWith('image/')) {
                      body.docPrefix = 'images'
                    }
                  }
                  req.json = async () => body
                } catch {
                  // ignore JSON parse errors, let original handler execute validation
                }
                return originalHandler(req)
              }
            }
          }

          return config
        }) as Plugin,
      ]
    : []),
]
