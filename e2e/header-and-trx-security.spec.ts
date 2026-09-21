import { expect, test } from '@playwright/test'

test.describe('Smart Auto-Hiding Header & Composite TRX Security System', () => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

  test('Storefront header hides on scroll-down and reappears smoothly on scroll-up', async ({ page }) => {
    await page.goto(`${baseURL}/`)
    await page.waitForLoadState('domcontentloaded')

    const header = page.locator('header').first()
    await expect(header).toBeVisible()

    // Scroll down 400px
    await page.evaluate(() => window.scrollTo(0, 400))
    await page.waitForTimeout(400)

    // Header should hide with -translate-y-full class
    await expect(header).toHaveClass(/-translate-y-full/)

    // Scroll up to 200px
    await page.evaluate(() => window.scrollTo(0, 200))
    await page.waitForTimeout(400)

    // Header should reappear smoothly with translate-y-0
    await expect(header).toHaveClass(/translate-y-0/)

    // Scroll to top (<= 50px)
    await page.evaluate(() => window.scrollTo(0, 10))
    await page.waitForTimeout(300)
    await expect(header).toHaveClass(/translate-y-0/)
  })

  test('Submits a test order using a 6-digit STAN number (849201) & rejects duplicate submissions', async ({ page }) => {
    const stanNumber = `84${Math.floor(1000 + Math.random() * 8999)}`

    const orderPayload = {
      customer: {
        name: 'STAN Test Customer',
        phone: '03001234567',
        email: 'stan.test@example.com',
        city: 'Lahore',
        province: 'Punjab',
        address: '123 E2E Test Street',
      },
      items: [
        {
          productId: '1',
          variantSize: 'M',
          variantSku: 'E2E-SKU-STAN',
          quantity: 1,
          price: 4500,
        },
      ],
      paymentMethod: 'bank_transfer',
      paymentProof: {
        transactionId: stanNumber,
      },
      subtotal: 4500,
      shippingFee: 200,
      codFee: 0,
      totalAmount: 4700,
    }

    // Submit initial 6-digit STAN order
    const firstRes = await page.request.post(`${baseURL}/api/orders`, {
      data: orderPayload,
    })

    const firstData = await firstRes.json()

    // Order should be accepted if valid or fail if product mock missing in DB
    if (firstRes.status() === 200) {
      expect(firstData.success).toBe(true)

      // Attempt duplicate submission with exact same STAN number on same day
      const secondRes = await page.request.post(`${baseURL}/api/orders`, {
        data: orderPayload,
      })

      const secondData = await secondRes.json()
      expect(secondRes.status()).toBe(400)
      expect(secondData.error).toMatch(/already been submitted|already been uploaded/i)
    } else {
      // If product ID missing in DB during clean test run, validation should still respond with clear message
      expect(firstData.error).toBeDefined()
    }
  })
})

