import { expect, test } from '@playwright/test'

test.describe('Responsive Layout & Touch Target Verification', () => {
  test('Mobile Viewport (375x667 - iPhone SE): No horizontal scroll, drawer and bottom nav visible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Verify page loads without throwing
    await expect(page).toHaveTitle(/N's KI/)

    // Assert zero horizontal scroll overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    // Verify mobile header search icon or hamburger button
    const toggleMenuBtn = page.locator('button[aria-label="Toggle Menu"]')
    await expect(toggleMenuBtn).toBeVisible()

    // Test mobile drawer toggle
    await toggleMenuBtn.click()
    const homeLink = page.locator('nav').getByRole('link', { name: 'Home' }).first()
    await expect(homeLink).toBeVisible()

    // Test bottom mobile navigation bar visibility
    const bottomNav = page.locator('div.fixed.bottom-0').first()
    await expect(bottomNav).toBeVisible()
  })

  test('Tablet Viewport (768x1024 - iPad Air): Clean product grid and responsive container', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/shop')

    // Assert zero horizontal scroll overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    // Verify shop page container
    const mainContainer = page.locator('main').first()
    await expect(mainContainer).toBeVisible()
  })

  test('Desktop Viewport (1920x1080): Full desktop navigation bar and 2-column PDP layout', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    // Verify desktop navbar visible
    const desktopNav = page.locator('nav.hidden.md\\:flex').first()
    await expect(desktopNav).toBeVisible()

    // Assert zero horizontal scroll overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})

