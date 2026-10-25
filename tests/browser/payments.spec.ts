import { test, expect, type Page } from '@playwright/test'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
let javascript = '',
  css = ''
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
    plugins: [
      {
        name: 'money-fixture',
        resolveId: (id) => (id === 'virtual:entry' ? '\0' + id : undefined),
        load: (id) =>
          id === '\0virtual:entry'
            ? `import React from'react';import{createRoot}from'react-dom/client';import{PaymentsPanel}from'@/components/admin/ReportsView/PaymentsPanel';import'@/components/admin/ReportsView/reports.css';createRoot(document.getElementById('root')).render(React.createElement('main',{className:'nski-reports'},React.createElement(PaymentsPanel)));`
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: 'virtual:entry', output: { format: 'iife', name: 'MoneyQA' } },
    },
  })
  for (const output of 'output' in result ? result.output : []) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})
async function open(page: Page, initialReady = true, failFirst = false) {
  let ready = initialReady
  const submissions: Record<string, unknown>[] = [],
    queries: URLSearchParams[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'store.example') return route.abort()
    if (url.pathname.endsWith('/status')) return route.fulfill({ json: { ready } })
    if (url.pathname.endsWith('/initialize')) {
      ready = true
      return route.fulfill({ json: { ready } })
    }
    if (url.pathname === '/api/admin/payments') {
      if (route.request().method() === 'POST') {
        submissions.push(route.request().postDataJSON())
        if (failFirst && submissions.length === 1)
          return route.fulfill({
            status: 503,
            json: { error: 'Recording outcome uncertain. Retry this same submission.' },
          })
        return route.fulfill({
          json: { id: submissions.at(-1)!.key, replayed: submissions.length > 1 },
        })
      }
      queries.push(url.searchParams)
      if (url.searchParams.get('orderId') === 'error-id')
        return route.fulfill({ status: 503, json: { error: 'Money report unavailable.' } })
      if (url.searchParams.get('format') === 'csv')
        return route.fulfill({ contentType: 'text/csv', body: 'id,amountPKR\r\nentry,500.25\r\n' })
      return route.fulfill({
        json: {
          filters: { ...Object.fromEntries(url.searchParams), format: 'json' },
          summary: {
            records: 51,
            collectedMinor: 50025,
            refundedMinor: 10000,
            netMovementMinor: 40025,
          },
          order: url.searchParams.get('orderId')
            ? {
                id: url.searchParams.get('orderId'),
                orderNumber: 'QA-123',
                status: 'confirmed',
                total: 1350,
                collectedMinor: 50025,
                refundedMinor: 10000,
                hasEntries: true,
              }
            : null,
          rows: [
            {
              id: 'd303277e-3c48-40e6-b7d0-9f2e6a300039',
              orderNumber: 'QA-123',
              kind: 'collection',
              amountMinor: 50025,
              method: 'cash',
              reason: 'customer_payment',
              refundOf: null,
              occurredAt: '2026-10-25T09:00:00Z',
              recordedAt: '2026-10-25T10:00:00Z',
              actorId: 'admin-1',
            },
          ],
          pagination: { page: Number(url.searchParams.get('page') || 1), totalPages: 2 },
        },
      })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<html><head><style>body{margin:0}${css}</style></head><body><div id="root"></div></body></html>`,
    })
  })
  await page.goto('https://store.example/money')
  await page.addScriptTag({ content: javascript })
  await expect(page.getByRole('heading', { name: 'Recorded payments & refunds' })).toBeVisible()
  return { submissions, queries }
}
async function loadOrder(page: Page) {
  await page.getByLabel('Money order ID (optional)').fill('order-1')
  await page.getByRole('button', { name: 'Load money report', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Order QA-123 · confirmed' })).toBeVisible()
}
test('explicit setup and report dates remain distinct from accepted orders; export uses applied filters', async ({
  page,
}) => {
  const { queries } = await open(page, false)
  await page.getByRole('button', { name: 'Enable payment recording' }).click()
  await loadOrder(page)
  await expect(
    page.getByText('This is not profit, net sales or courier settlement.', { exact: false }),
  ).toBeVisible()
  await page.getByLabel('Money order ID (optional)').fill('unsaved-id')
  await page.getByRole('button', { name: 'Next money page' }).click()
  expect(queries.at(-1)?.get('orderId')).toBe('order-1')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export money CSV (max 5,000)' }).click()
  await download
  expect(queries.at(-1)?.get('orderId')).toBe('order-1')
})
test('uncertain recording survives remount and retries the identical command without double recording', async ({
  page,
}) => {
  const { submissions } = await open(page, true, true)
  await loadOrder(page)
  await page.getByLabel('Actual amount (PKR)').fill('500.25')
  await page.getByLabel('Actual time (your browser timezone)').fill('2026-10-25T12:00')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Record verified money event' }).click()
  await expect(page.getByRole('alert')).toContainText('outcome uncertain')
  await expect(page.getByLabel('Actual amount (PKR)')).toBeDisabled()
  await page.reload()
  await page.addScriptTag({ content: javascript })
  await expect(page.getByRole('button', { name: 'Retry same money submission' })).toBeVisible()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Retry same money submission' }).click()
  await expect(page.getByRole('status')).toContainText('existing submission recovered')
  expect(submissions).toHaveLength(2)
  expect(submissions[1]).toEqual(submissions[0])
})
test('refund requires a linked collection and errors remove stale report data', async ({
  page,
}) => {
  const { submissions } = await open(page)
  await loadOrder(page)
  await page.getByLabel('Money event').selectOption('refund')
  await page.getByLabel('Actual amount (PKR)').fill('100.01')
  await page.getByLabel('Actual time (your browser timezone)').fill('2026-10-25T12:00')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Record verified money event' }).click()
  expect(submissions).toHaveLength(0)
  await page.getByLabel('Original collection entry ID').fill('d303277e-3c48-40e6-b7d0-9f2e6a300039')
  await page.getByRole('button', { name: 'Record verified money event' }).click()
  await expect(page.getByRole('status')).toContainText('Recorded refund')
  expect(submissions[0]).toMatchObject({
    kind: 'refund',
    reason: 'return',
    refundOf: 'd303277e-3c48-40e6-b7d0-9f2e6a300039',
  })
  await page.getByLabel('Money order ID (optional)').fill('error-id')
  await page.getByRole('button', { name: 'Load money report' }).click()
  await expect(page.getByRole('alert')).toContainText('Money report unavailable')
  await expect(page.getByRole('button', { name: 'Export money CSV (max 5,000)' })).toHaveCount(0)
})
test('mobile money controls fit the page and attestation stays beside its text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await loadOrder(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const box = await page.getByRole('checkbox').boundingBox()
  expect(box?.width).toBe(18)
  expect((await page.getByLabel('Actual time (your browser timezone)').boundingBox())!.width).toBeGreaterThan(250)
  await page.screenshot({ path: '/tmp/nski-money-mobile.png', fullPage: true })
})
