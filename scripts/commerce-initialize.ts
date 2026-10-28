/** Explicit schema/index setup. Never imported by a customer request. */
export {}
const url = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL || ''
if (!/^mongodb(?:\+srv)?:\/\//.test(url)) throw new Error('A MongoDB connection URL is required.')
const local = /^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(url)
if (!local && !process.argv.includes('--allow-remote'))
  throw new Error(
    'Remote setup requires --allow-remote after reviewing the database target and taking a backup.',
  )
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { initializeCommerce } = await import('../src/utilities/commerceDatabase')
const payload = await getPayload({ config })
try {
  await initializeCommerce(payload)
  console.log('Commerce collections, indexes and replica-set transaction verified.')
} finally {
  await payload.destroy()
}
