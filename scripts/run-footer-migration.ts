import { getPayload } from 'payload'
import { up } from '../src/migrations/20260909_163800_footer_columns'
import configPromise from '../src/payload.config'

async function run() {
  console.log('Initializing Payload for migration...')
  const payload = await getPayload({ config: configPromise })
  const db = payload.db as any

  console.log('Running up() for 20260909_163800_footer_columns...')
  await up({ db: db.drizzle, payload, req: {} as any })
  console.log('Migration complete!')

  // Record it in payload_migrations table so Payload knows it ran
  try {
    await payload.create({
      collection: 'payload-migrations' as any,
      data: {
        name: '20260909_163800_footer_columns',
        batch: 2,
      } as any,
    })
    console.log('Migration recorded in payload_migrations.')
  } catch (e: any) {
    console.log('Could not record migration (may already exist):', e.message)
  }

  process.exit(0)
}

run().catch((err) => {
  console.error('Migration Error:', err)
  process.exit(1)
})
