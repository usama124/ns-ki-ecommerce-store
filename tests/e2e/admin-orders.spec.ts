import { expect, Page, test } from '@playwright/test'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Orders Management Dashboard', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to orders management dashboard and view stats cards', async () => {
    await page.goto('http://localhost:3000/admin/orders-dashboard')
    await expect(page).toHaveURL('http://localhost:3000/admin/orders-dashboard')
    const heading = page.locator('h1', { hasText: 'Orders & Verification Dashboard' })
    await expect(heading).toBeVisible()

    const lifetimeCard = page.locator('div', { hasText: 'Lifetime Orders' }).first()
    await expect(lifetimeCard).toBeVisible()
  })
})

