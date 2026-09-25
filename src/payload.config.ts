import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Orders } from '@/collections/Orders'
import { Pages } from '@/collections/Pages'
import { Products } from '@/collections/Products'
import { Sizes } from '@/collections/Sizes'
import { Users } from '@/collections/Users'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { Homepage } from '@/globals/Homepage'
import { SaleSettings } from '@/globals/SaleSettings'
import { SiteSettings } from '@/globals/SiteSettings'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const dbAdapterType = (process.env.DB_ADAPTER || '').toLowerCase()
const shouldPushSchema = process.env.DB_PUSH !== 'false'

const mongoUrl =
  process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL || ''
const isMongo =
  dbAdapterType === 'mongodb' ||
  dbAdapterType === 'mongo' ||
  mongoUrl.startsWith('mongodb://') ||
  mongoUrl.startsWith('mongodb+srv://')

const db = isMongo
  ? mongooseAdapter({
      url: mongoUrl,
    })
  : dbAdapterType === 'turso' || dbAdapterType === 'sqlite' || dbAdapterType === 'libsql'
    ? sqliteAdapter({
        client: {
          url: process.env.TURSO_DATABASE_URL || 'file:./payload.db',
          authToken: process.env.TURSO_AUTH_TOKEN || undefined,
        },
        push: shouldPushSchema,
      })
    : postgresAdapter({
        pool: {
          connectionString: process.env.DATABASE_URL || '',
        },
        push: shouldPushSchema,
      })

export default buildConfig({
  routes: {
    admin: '/store-admin',
  },
  admin: {
    components: {
      graphics: {
        Logo: '@/components/admin/Logo#default',
        Icon: '@/components/admin/Icon#default',
      },
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
      afterNavLinks: [
        '@/components/admin/InventoryNavLink#InventoryNavLink',
        '@/components/admin/OrdersDashboardNavLink#OrdersDashboardNavLink',
        '@/components/admin/SaleDashboardNavLink#SaleDashboardNavLink',
      ],
      views: {
        inventory: {
          Component: '@/components/admin/InventoryView#InventoryView',
          path: '/inventory',
        },
        ordersDashboard: {
          Component: '@/components/admin/OrdersDashboardView#OrdersDashboardView',
          path: '/orders-dashboard',
        },
        saleDashboard: {
          Component: '@/components/admin/SaleDashboardView#SaleDashboardView',
          path: '/sale-dashboard',
        },
      },
    },
    user: Users.slug,
    suppressHydrationWarning: true,
  },
  collections: [Users, Pages, Categories, Products, Media, Orders, Sizes],
  db,
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages', 'products'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })
            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: ({ linkType }) => linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  endpoints: [],
  globals: [Header, Footer, Homepage, SiteSettings, SaleSettings],
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  sharp: undefined,
})
