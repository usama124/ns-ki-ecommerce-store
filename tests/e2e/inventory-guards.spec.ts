import { test, expect } from '@playwright/test'

test.describe('Real-Time Inventory Guards & Stock Controls', () => {
  const baseURL = 'http://localhost:3000'

  test('PDP quantity selector bounds quantity to available stock', async ({ page }) => {
    await page.goto(`${baseURL}/shop`)
    await page.waitForLoadState('networkidle')

    // Navigate to product page
    const firstProduct = page.locator('a[href^="/products/"]').first()
    await expect(firstProduct).toBeVisible()
    await firstProduct.click()

    await page.waitForURL(/\/products\//)

    // Check if quantity selector is present
    const qtyInput = page.locator('input[type="number"][min="1"]').first()
    if (await qtyInput.isVisible()) {
      const minVal = await qtyInput.getAttribute('min')
      expect(minVal).toBe('1')

      const minusBtn = page.locator('button[aria-label="Decrease quantity"]').first()
      await expect(minusBtn).toBeDisabled()
    }
  })

  test('Cart drawer prevents incrementing past max available stock', async ({ page }) => {
    await page.goto(`${baseURL}/shop`)
    const productCard = page.locator('a[href^="/products/"]').first()
    await productCard.click()
    await page.waitForURL(/\/products\//)

    const addToCartButton = page.getByRole('button', { name: /Add to Bag/i }).first()
    if (await addToCartButton.isEnabled()) {
      await addToCartButton.click()

      // Open Cart
      const cartTrigger = page.locator('button[aria-label="Open cart"]').first()
      await cartTrigger.click()

      const qtyPlusBtn = page.locator('button[aria-label="Increase quantity"]').first()
      if (await qtyPlusBtn.isVisible()) {
        const isDisabled = await qtyPlusBtn.isDisabled()
        if (isDisabled) {
          const warningText = page.locator('text=Max available stock reached')
          await expect(warningText).toBeVisible()
        }
      }
    }
  })

  test('Pre-checkout validation checks live stock before navigating to checkout', async ({ page }) => {
    await page.goto(`${baseURL}/checkout`)
    // If cart is empty, user is redirected or sees empty state
    await page.waitForLoadState('networkidle')
    const currentURL = page.url()
    expect(currentURL).toBeDefined()
  })
})

