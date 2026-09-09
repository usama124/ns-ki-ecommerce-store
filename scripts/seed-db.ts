import { getPayload } from 'payload'
import { seed } from '../src/endpoints/seed'
import configPromise from '../src/payload.config'

async function run() {
  console.log('Initializing Payload...')
  const payload = await getPayload({ config: configPromise })
  console.log('Running seed function...')
  await seed({ payload, req: {} as any })
  const categories = await payload.find({ collection: 'categories' })
  console.log(`Seeded ${categories.totalDocs} categories successfully!`)
  process.exit(0)
}

run().catch((err) => {
  console.error('Seed Error:', err)
  process.exit(1)
})
