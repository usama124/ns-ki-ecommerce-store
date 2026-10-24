import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

let javascript = ''
let css = ''
test.beforeAll(async () => {
  const sourceRoot = fileURLToPath(new URL('../../src', import.meta.url))
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { CheckoutPage } from '@/components/checkout/CheckoutPage';
    import { PrivateReceipt } from '@/components/orders/PrivateReceipt';
    import ${JSON.stringify(`${sourceRoot}/app/(app)/globals.css`)};
    createRoot(document.getElementById('root')).render(location.pathname === '/receipt-test' ? React.createElement(PrivateReceipt, {orderId:'order1',token:'signed-token'}) : React.createElement(CheckoutPage, {siteSettings:{
      shipping:{codFee:100,majorCityFee:250,secondaryCityFee:350,freeShippingThreshold:15000},
      paymentDetails:{jazzcash:{mobileNumber:'03001112222',accountName:'Test Merchant'}}
    }}));
  `
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        { find: '@/providers/Cart', replacement: 'virtual:cart' },
        { find: 'next/navigation', replacement: 'virtual:navigation' },
        { find: '@', replacement: sourceRoot },
      ],
    },
    esbuild: { jsx: 'automatic' },
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
    plugins: [
      {
        name: 'checkout-fixture',
        resolveId: (id) => (id.startsWith('virtual:') ? `\0${id}` : undefined),
        load: (id) =>
          id === '\0virtual:checkout'
            ? entry
            : id === '\0virtual:cart'
              ? `export const useCart=()=>({items:[{productId:'p1',title:'Test suit',variantSize:'M',price:3500,quantity:2}],subtotal:7000,clearCart:()=>{window.cartCleared=true}});`
              : id === '\0virtual:navigation'
                ? `export const useRouter=()=>({push:url=>{window.navigatedTo=url}});`
                : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: 'virtual:checkout',
        output: { format: 'iife', name: 'CheckoutFixture' },
      },
    },
  })
  const outputs = Array.isArray(result)
    ? result.flatMap((item) => item.output)
    : 'output' in result
      ? result.output
      : []
  for (const output of outputs) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})

test('checkout presents a changed quote before a second explicit submission and uses private receipt uploads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests: Array<Record<string, unknown>> = []
  await page.route('https://store.example/**', async (route) => {
    if (route.request().url().endsWith('/api/orders')) {
      requests.push(route.request().postDataJSON())
      await route.fulfill({
        contentType: 'application/json',
        status: requests.length === 1 ? 409 : 200,
        body: JSON.stringify(
          requests.length === 1
            ? {
                code: 'QUOTE_CHANGED',
                quote: {
                  subtotal: 8000,
                  shippingFee: 250,
                  codFee: 100,
                  totalAmount: 8350,
                  items: [{ product: 'p1', variantSize: 'M', quantity: 2, unitPrice: 4000 }],
                },
              }
            : {
                success: true,
                orderNumber: '#NKI-123456',
                orderId: 'order1',
                accessToken: 'signed-token',
              },
        ),
      })
    } else
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><div id="root"></div></body></html>',
      })
  })
  await page.goto('https://store.example/')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: javascript })
  await page.getByPlaceholder('e.g. Fatima Khan').fill('Test Customer')
  await page.getByPlaceholder('e.g. 03001234567').fill('03001112222')
  await page.getByPlaceholder('fatima@example.com').fill('customer@example.test')
  await page.getByPlaceholder('House No, Street, Sector/Block, LandMark').fill('Test address')
  await page.getByRole('button', { name: /Complete Order/ }).click()
  await expect(page.getByRole('button', { name: /Confirm Updated Total/ })).toBeVisible()
  await expect(page.getByText(/Prices or fees have changed/)).toBeVisible()
  expect(requests).toHaveLength(1)
  await expect(page.getByText(/8,350/)).toBeVisible()
  await page.getByRole('button', { name: /Confirm Updated Total/ }).click()
  await expect
    .poll(() => page.evaluate(() => (window as Window & { navigatedTo?: string }).navigatedTo))
    .toContain('token=signed-token')
  expect(requests[1].expectedTotal).toBe(8350)
  expect(requests).toHaveLength(2)
  await page.getByRole('button', { name: /JazzCash Wallet/ }).click()
  await expect(page.getByText(/Stored privately after your order is placed/)).toBeVisible()
  await expect(page.getByLabel('Payment receipt', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Bank \/ Raast Transfer/ })).toBeDisabled()
})

for (const outcome of ['success', 'failure'] as const) {
  test(`digital checkout uploads after creation and handles receipt ${outcome} without creating another order`, async ({
    page,
  }) => {
    let orders = 0
    let uploads = 0
    await page.route('https://store.example/**', async (route) => {
      const url = route.request().url()
      if (url.endsWith('/api/orders')) {
        orders++
        expect(uploads).toBe(0)
        expect(route.request().postDataJSON().paymentProof).toEqual({ transactionId: 'TEST123456' })
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            orderNumber: '#NKI-123456',
            orderId: 'order1',
            accessToken: 'signed-token',
          }),
        })
      } else if (url.endsWith('/api/orders/order1/receipt')) {
        uploads++
        expect(orders).toBe(1)
        expect(route.request().headers()['x-order-token']).toBe('signed-token')
        expect(route.request().headers()['content-type']).toBe('image/png')
        await route.fulfill({
          status: outcome === 'success' ? 201 : 503,
          contentType: 'application/json',
          body: JSON.stringify(
            outcome === 'success' ? { success: true } : { error: 'Storage unavailable.' },
          ),
        })
      } else
        await route.fulfill({
          contentType: 'text/html',
          body: '<html><body><div id="root"></div></body></html>',
        })
    })
    await page.goto('https://store.example/')
    await page.addStyleTag({ content: css })
    await page.addScriptTag({ content: javascript })
    await page.getByPlaceholder('e.g. Fatima Khan').fill('Test Customer')
    await page.getByPlaceholder('e.g. 03001234567').fill('03001112222')
    await page.getByPlaceholder('fatima@example.com').fill('customer@example.test')
    await page.getByPlaceholder('House No, Street, Sector/Block, LandMark').fill('Test address')
    await page.getByRole('button', { name: /JazzCash Wallet/ }).click()
    await page.getByPlaceholder('e.g. 849201 or 019283746501').fill('TEST123456')
    await page
      .getByLabel('Payment receipt', { exact: true })
      .setInputFiles({
        name: 'receipt.png',
        mimeType: 'image/png',
        buffer: Buffer.from('local mock receipt'),
      })
    await page.getByRole('button', { name: /Complete Order/ }).click()
    await expect
      .poll(() => page.evaluate(() => (window as Window & { navigatedTo?: string }).navigatedTo))
      .toContain('token=signed-token')
    const target = await page.evaluate(
      () => (window as Window & { navigatedTo?: string }).navigatedTo,
    )
    expect(target?.includes('receiptFailed=1')).toBe(outcome === 'failure')
    expect(
      await page.evaluate(() => (window as Window & { cartCleared?: boolean }).cartCleared),
    ).toBe(true)
    expect(orders).toBe(1)
    expect(uploads).toBe(1)
  })
}

test('secure order receipt panel supports retry and private viewing', async ({ page }) => {
  let uploaded = false
  let attempts = 0
  await page.route('https://store.example/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/receipt')) {
      if (route.request().method() === 'POST') {
        attempts++
        expect(route.request().headers()['x-order-token']).toBe('signed-token')
        uploaded = attempts > 1
        await route.fulfill({
          status: uploaded ? 201 : 503,
          contentType: 'application/json',
          body: JSON.stringify(uploaded ? { success: true } : { error: 'Retry this upload.' }),
        })
      } else if (url.searchParams.get('info') === '1') {
        expect(route.request().headers()['x-order-token']).toBe('signed-token')
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ exists: uploaded, canUpload: !uploaded }),
        })
      } else
        await route.fulfill({
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=',
            'base64',
          ),
        })
    } else
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><div id="root"></div></body></html>',
      })
  })
  await page.goto('https://store.example/receipt-test')
  await page.addScriptTag({ content: javascript })
  const input = page.getByLabel('Payment receipt', { exact: true })
  await expect(input).toBeVisible()
  await input.setInputFiles({
    name: 'unsafe.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  })
  await expect(page.getByRole('status')).toHaveText('Use a JPEG, PNG or WebP image.')
  await expect(page.getByRole('button', { name: 'Upload receipt securely' })).toBeDisabled()
  await input.setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('mock image'),
  })
  await page.getByRole('button', { name: 'Upload receipt securely' }).click()
  await expect(page.getByRole('status')).toHaveText('Retry this upload.')
  await page.getByRole('button', { name: 'Upload receipt securely' }).click()
  const link = page.getByRole('link', { name: 'Open receipt in a new tab' })
  await expect(link).toHaveAttribute('href', '/api/orders/order1/receipt?token=signed-token')
  await expect(page.getByRole('img', { name: 'Payment receipt' })).toBeVisible()
  await expect(input).toHaveCount(0)
  expect(attempts).toBe(2)
})
