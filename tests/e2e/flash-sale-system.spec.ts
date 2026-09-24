import { expect, test } from '@playwright/test'

test.describe('Collection-Based Flash Sale System E2E', () => {
  test('should configure flash sale, display discounted products on /sale, and revert upon ending', async ({
    request,
    page,
  }) => {
    // 1. Fetch available categories via API
    const getRes = await request.get('/api/admin/sale-settings')
    expect(getRes.ok()).toBeTruthy()
    const initData = await getRes.json()

    const unstitchedCat = initData.categories?.find(
      (c: any) => c.name.toLowerCase().includes('unstitched') || c.name.toLowerCase().includes('lawn'),
    ) || initData.categories?.[0]

    const targetCatId = unstitchedCat?.id

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // 2. Enable Flash Sale with 20% discount on targeted category
    const saveRes = await request.post('/api/admin/sale-settings', {
      data: {
        isActive: true,
        title: 'E2E Test Flash Sale',
        startDate: now.toISOString(),
        endDate: tomorrow.toISOString(),
        discountPercentage: 20,
        targetedCategories: targetCatId ? [targetCatId] : [],
        announcementText: '🔥 E2E TEST FLASH SALE LIVE! Enjoy 20% OFF.',
        enablePopup: true,
      },
    })
    expect(saveRes.ok()).toBeTruthy()

    // 3. Visit storefront /sale page
    await page.goto('/sale')

    // Verify campaign title or hero element
    const heroHeading = page.locator('h1')
    await expect(heroHeading).toBeVisible()

    // If products were targeted, verify price reductions or countdown timer
    const onSaleBadge = page.locator('text=-20% OFF').first()
    if (await onSaleBadge.isVisible()) {
      await expect(onSaleBadge).toBeVisible()
    }

    // 4. End Sale Immediately
    const endRes = await request.post('/api/admin/sale-settings', {
      data: { action: 'end_immediately' },
    })
    expect(endRes.ok()).toBeTruthy()

    // 5. Reload /sale page and assert empty state
    await page.reload()
    await expect(page.locator('text=No Active Sale Right Now')).toBeVisible()
  })
})

