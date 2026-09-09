import { getPayload } from 'payload'
import configPromise from '../src/payload.config'

async function check() {
  const payload = await getPayload({ config: configPromise })
  const categories = await payload.find({ collection: 'categories' })
  const products = await payload.find({ collection: 'products' })

  console.log('--- DATABASE CHECK SUCCESSFUL ---')
  console.log('Categories Count:', categories.totalDocs)
  console.log(
    'Categories:',
    categories.docs.map((c: any) => c.name),
  )
  console.log('Products Count:', products.totalDocs)
  console.log(
    'Products:',
    products.docs.map((p: any) => p.title),
  )
  process.exit(0)
}

check().catch((err) => {
  console.error(err)
  process.exit(1)
})
