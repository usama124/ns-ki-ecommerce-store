/** QA fixtures only. Run inside the outbound-isolated QA app container. */
import { getPayload } from 'payload'
import configPromise from '../../src/payload.config'
import { initializeCommerce } from '../../src/utilities/commerceDatabase'
import sharp from 'sharp'

if (!process.env.MONGODB_URI?.includes('/nski_qa_working?') || process.env.PAYLOAD_SECRET !== 'isolated-qa-only-not-a-production-secret') throw new Error('Refusing non-QA environment')
const config = await configPromise
config.typescript.autoGenerate = false
const payload = await getPayload({ config })
const tag = 'qa-audit-20261024'
try {
  const prior = await payload.find({ collection: 'categories', where: { slug: { equals: tag } }, limit: 1 })
  if (prior.docs.length) throw new Error('QA fixtures already exist. Restore a fresh working copy before reseeding; baseline must stay untouched.')
  // Provisioning is explicit; the untouched baseline is never initialized.
  await initializeCommerce(payload)
  const accounts: Record<string, string | number> = {}
  for (const role of ['admin', 'customer', 'other']) {
    const email = `${tag}-${role}@example.invalid`
    const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
    accounts[role] = existing.docs[0]?.id || (await payload.create({ collection: 'users', data: { name: `Synthetic QA ${role}`, email, password: 'SyntheticQA-Only#2026', roles: [role === 'admin' ? 'admin' : 'customer'] } })).id
  }
  const category = await payload.create({ collection: 'categories', data: { name: 'QA Test Collection', slug: tag, type: 'main' }, context: { disableRevalidate: true } })
  const sub = await payload.create({ collection: 'categories', data: { name: 'QA Test Subcollection', slug: `${tag}-sub`, type: 'subcategory', parent: category.id }, context: { disableRevalidate: true } })
  const size = await payload.create({ collection: 'sizes', data: { name: 'QA-M' } })
  const small = await payload.create({ collection: 'sizes', data: { name: 'QA-S' } })
  const data = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#648698' } }).webp().toBuffer()
  const media = await payload.create({ collection: 'media', data: { alt: 'Synthetic QA product image' }, file: { data, name: `${tag}.webp`, mimetype: 'image/webp', size: data.length } })
  const products: Record<string, unknown> = {}
  for (const [name, status, stock, price] of [['suit', 'published', 50, 1000], ['draft', 'draft', 3, 1000], ['low', 'published', 1, 2000]] as const) {
    const product = await payload.create({ collection: 'products', data: { title: `QA ${name} ${tag}`, slug: `${tag}-${name}`, status, primaryCategory: category.id, categories: [sub.id], basePricePKR: price, images: [{ image: media.id }], variants: [{ size: size.id, stock, pricePKR: price, sku: `QA-${name}-M` }, { size: small.id, stock: 0, pricePKR: price + 500, sku: `QA-${name}-S` }] }, context: { skipShoppableVideoSync: true } })
    products[name] = { id: String(product.id), slug: product.slug, title: product.title }
  }
  // Sanitize ONLY the working-copy test configuration; never use real payment destinations.
  await payload.updateGlobal({ slug: 'site-settings', data: { shipping: { majorCityFee: 250, secondaryCityFee: 350, freeShippingThreshold: 15000, codFee: 100 }, paymentDetails: { bankTransfer: { bankName: 'SYNTHETIC QA BANK', accountTitle: 'TEST ONLY NO PAYMENTS', accountNumber: 'PK41SYNTHETIC000000000000', raastId: '' }, jazzcash: { accountName: 'SYNTHETIC QA ONLY', mobileNumber: '03009998888' }, easypaisa: { accountName: 'SYNTHETIC QA ONLY', mobileNumber: '03009997777' } } }, context: { disableRevalidate: true } })
  await payload.updateGlobal({ slug: 'sale-settings', data: { isActive: false }, context: { disableRevalidate: true } })
  console.log(JSON.stringify({ fixture: tag, accounts, category: String(category.id), subcategory: String(sub.id), products }))
} finally { await payload.destroy() }
