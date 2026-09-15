import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest } from 'payload'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'products',
  'orders',
  'sizes',
]

const globals: GlobalSlug[] = ['header', 'footer', 'homepage', 'site-settings']

export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info("Seeding database for N's KI Pakistani Luxury Fashion...")

  // Clear globals
  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {},
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })
  }

  // Create Core Categories
  const mainCategories = [
    { name: 'Unstitched', slug: 'unstitched', isFixed: true },
    { name: 'Ready To Wear', slug: 'ready-to-wear', isFixed: true },
    { name: 'Luxury Lawn', slug: 'luxury-lawn', isFixed: true },
    { name: 'Chiffon Formals', slug: 'chiffon-formals', isFixed: true },
    { name: 'Sale', slug: 'sale', isFixed: true },
  ]

  const createdMain = await Promise.all(
    mainCategories.map((cat) =>
      payload.create({
        collection: 'categories',
        data: {
          name: cat.name,
          slug: cat.slug,
          type: 'main',
          isFixed: cat.isFixed,
        },
      }),
    ),
  )

  const unstitchedCat = createdMain[0]

  // Create Subcategory
  const subCat = await payload.create({
    collection: 'categories',
    data: {
      name: "Luxury Lawn '25",
      slug: 'luxury-lawn-25',
      type: 'subcategory',
      parent: unstitchedCat.id,
    },
  })

  // Create Default Sizes
  const sizeNames = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Unstitched', 'Free Size']
  const createdSizes = await Promise.all(
    sizeNames.map((name, i) =>
      payload.create({ collection: 'sizes', data: { name, sortOrder: (i + 1) * 10 } }),
    ),
  )
  const sizeMap = Object.fromEntries(createdSizes.map((s) => [s.name, s.id]))

  // Create Sample Product (sizes reference IDs from the sizes collection)
  await payload.create({
    collection: 'products',
    data: {
      title: 'ZARAH - Embroidered Chiffon 3-Piece',
      slug: 'zarah-embroidered-chiffon-3-piece',
      status: 'published',
      isFeatured: true,
      primaryCategory: unstitchedCat.id,
      categories: [unstitchedCat.id, subCat.id],
      basePricePKR: 18500,
      color: 'Emerald Green',
      variants: [
        { size: sizeMap['XS'], stock: 10, sku: 'NKI-ZARA-XS-101' },
        { size: sizeMap['S'], stock: 8, sku: 'NKI-ZARA-SM-102' },
        { size: sizeMap['M'], stock: 15, sku: 'NKI-ZARA-MD-103' },
        { size: sizeMap['L'], stock: 5, sku: 'NKI-ZARA-LG-104' },
        { size: sizeMap['XL'], stock: 0, sku: 'NKI-ZARA-XL-105' },
        { size: sizeMap['Unstitched'], stock: 20, sku: 'NKI-ZARA-UN-106' },
      ],
    },
  })

  // Header Global
  await payload.updateGlobal({
    slug: 'header',
    data: {
      navItems: [
        { link: { type: 'custom', label: 'Home', url: '/' } },
        { link: { type: 'custom', label: 'Shop', url: '/shop' } },
        { link: { type: 'custom', label: 'Unstitched', url: '/shop/unstitched' } },
        { link: { type: 'custom', label: 'Ready To Wear', url: '/shop/ready-to-wear' } },
        { link: { type: 'custom', label: 'Sale', url: '/shop/sale' } },
      ],
    },
  })

  // Footer Global
  await payload.updateGlobal({
    slug: 'footer',
    data: {
      tagline: 'Pakistani Luxury Fashion',
      paymentNote: 'We accept Cash on Delivery, Bank Transfer (Meezan Bank), JazzCash & EasyPaisa',
      copyrightText: "N's KI Luxury Fashion. All rights reserved.",
      socialLinks: {
        instagram: 'https://instagram.com/nski.pk',
        facebook: 'https://facebook.com/nski.pk',
        tiktok: 'https://tiktok.com/@nski.pk',
        whatsapp: '923001234567',
      },
      columns: [
        {
          heading: 'Shop',
          links: [
            { link: { type: 'custom', label: 'All Products', url: '/shop' } },
            { link: { type: 'custom', label: 'Unstitched', url: '/shop/unstitched' } },
            { link: { type: 'custom', label: 'Ready To Wear', url: '/shop/ready-to-wear' } },
            { link: { type: 'custom', label: 'Luxury Lawn', url: '/shop/luxury-lawn' } },
            { link: { type: 'custom', label: 'Chiffon Formals', url: '/shop/chiffon-formals' } },
            { link: { type: 'custom', label: 'Sale', url: '/shop/sale' } },
          ],
        },
        {
          heading: 'Customer Service',
          links: [
            { link: { type: 'custom', label: 'Track Your Order', url: '/find-order' } },
            { link: { type: 'custom', label: 'Checkout', url: '/checkout' } },
            { link: { type: 'custom', label: 'Login', url: '/login' } },
            { link: { type: 'custom', label: 'Create Account', url: '/create-account' } },
            { link: { type: 'custom', label: 'Forgot Password', url: '/forgot-password' } },
          ],
        },
        {
          heading: 'Contact Us',
          links: [
            { link: { type: 'custom', label: 'WhatsApp Us', url: 'https://wa.me/923001234567' } },
            { link: { type: 'custom', label: 'Email Us', url: 'mailto:info@nski.pk' } },
          ],
        },
      ],
    },
  })

  // Site Settings Global
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      announcementBar: {
        isActive: true,
        text: 'FREE EXPRESS SHIPPING ACROSS PAKISTAN ON ORDERS ABOVE RS. 15,000',
      },
      shipping: {
        freeShippingThreshold: 15000,
        majorCityFee: 250,
        secondaryCityFee: 350,
        codFee: 250,
      },
      paymentDetails: {
        bankTransfer: {
          bankName: 'Meezan Bank',
          accountTitle: "N's KI LUXURY FASHION",
          accountNumber: 'PK00MEZN0001020304050607',
          raastId: '03001234567',
        },
        jazzcash: {
          mobileNumber: '03001234567',
          accountName: "N's KI CLOTHING",
        },
        easypaisa: {
          mobileNumber: '03001234567',
          accountName: "N's KI CLOTHING",
        },
      },
    },
  })

  payload.logger.info("N's KI database seeded successfully!")
}
