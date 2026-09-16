import { test, expect } from '@playwright/test'

test.describe('Automated Shoppable Video Sync E2E', () => {
  const baseURL = 'http://localhost:3000'

  test('Shop by Video reel appears on homepage with product title when video is present', async ({
    page,
    request,
  }) => {
    // 1. Fetch a media item to attach as sample video/image
    const mediaRes = await request.get(`${baseURL}/api/media?limit=1`)
    const mediaJson = await mediaRes.json()
    const sampleMediaId = mediaJson.docs?.[0]?.id

    if (!sampleMediaId) {
      test.skip(true, 'No media records available in database to attach video')
      return
    }

    const testTitle = `Zarah Velvet Chiffon ${Date.now()}`
    const testSlug = `zarah-velvet-chiffon-${Date.now()}`

    // Fetch category ID
    const catRes = await request.get(`${baseURL}/api/categories?limit=1`)
    const catJson = await catRes.json()
    const categoryId = catJson.docs?.[0]?.id

    // 2. Create and publish a product with productVideo attached
    const productRes = await request.post(`${baseURL}/api/products`, {
      data: {
        title: testTitle,
        slug: testSlug,
        status: 'published',
        _status: 'published',
        primaryCategory: categoryId,
        categories: categoryId ? [categoryId] : [],
        basePricePKR: 24500,
        productVideo: sampleMediaId,
        images: [
          {
            image: sampleMediaId,
            alt: testTitle,
          },
        ],
      },
    })

    expect(productRes.ok()).toBeTruthy()

    // 3. Visit storefront Homepage
    await page.goto(baseURL)

    // 4. Assert "Shop By Video" section is visible
    const shopByVideoHeading = page.getByRole('heading', { name: /Shop By Video/i })
    await expect(shopByVideoHeading).toBeVisible({ timeout: 10000 })

    // 5. Assert the video reel displays the product title automatically
    const reelTitle = page.getByText(testTitle, { exact: false }).first()
    await expect(reelTitle).toBeVisible()
  })
})

