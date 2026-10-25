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
        name: 'insight-fixture',
        resolveId: (id) => (id === 'virtual:entry' ? '\0' + id : undefined),
        load: (id) =>
          id === '\0virtual:entry'
            ? `import React from'react';import{createRoot}from'react-dom/client';import{InsightsPanel}from'@/components/admin/ReportsView/InsightsPanel';import'@/components/admin/ReportsView/reports.css';createRoot(document.getElementById('root')).render(React.createElement('main',{className:'nski-reports'},React.createElement(InsightsPanel)));`
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: 'virtual:entry', output: { format: 'iife', name: 'InsightQA' } },
    },
  })
  for (const output of 'output' in result ? result.output : []) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})
async function open(page: Page, initialReady = true, enabled = true) {
  let ready = initialReady
  const queries: URLSearchParams[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'store.example') return route.abort()
    if (url.pathname.endsWith('/status'))
      return route.fulfill({
        json: {
          ready,
          historyReady: enabled,
          moneyReady: enabled,
          historyStartedAt: enabled ? '2026-10-01T07:00:00Z' : null,
          moneyStartedAt: enabled ? '2026-10-01T07:00:00Z' : null,
        },
      })
    if (url.pathname.endsWith('/initialize')) {
      ready = true
      return route.fulfill({ json: { ready: true } })
    }
    if (url.pathname === '/api/admin/insights') {
      const query = url.searchParams
      queries.push(query)
      if (query.get('productId') === 'error-id')
        return route.fulfill({ status: 503, json: { error: 'Insights temporarily unavailable.' } })
      if (query.get('format') === 'csv')
        return route.fulfill({ contentType: 'text/csv', body: 'day,value\r\n2026-10-25,1350\r\n' })
      const stock = query.get('view') === 'stock'
      return route.fulfill({
        json: {
          filters: { ...Object.fromEntries(query), format: 'json' },
          generatedAt: '2026-10-25T12:00:00Z',
          definition: stock
            ? 'Current variants only. Physical unit aging is unavailable; allocation coverage is not a demand forecast.'
            : 'Independent first milestone and money event series, not a conversion cohort.',
          summary: stock
            ? {
                variants: 61,
                untracked: 1,
                drifted: 0,
                fullWindow: 60,
                inactive30Plus: 5,
                recordedAllocatedUnits: 12,
                recordedRestoredUnits: 2,
              }
            : {
                firstConfirmed: enabled ? 1 : null,
                firstConfirmedValuePKR: enabled ? 1350 : null,
                firstShipped: enabled ? 1 : null,
                firstDelivered: enabled ? 0 : null,
                collectedPKR: enabled ? 500.25 : null,
                refundedPKR: enabled ? 100.01 : null,
                netRecordedPKR: enabled ? 400.24 : null,
              },
          rows: stock
            ? [
                {
                  productId: 'product-1',
                  variantId: 'variant-1',
                  title: 'Original <script>safe</script> suit',
                  sku: 'QA-M',
                  stock: 8,
                  coverage: 'partial_window',
                  baselineAt: '2026-10-10T00:00:00Z',
                  lastObservedChangeAt: '2026-10-20T00:00:00Z',
                  daysWithoutRecordedChange: 5,
                  openingStock: null,
                  closingStock: 8,
                  recordedNetChange: -12,
                  allocatedUnits: 12,
                  restoredUnits: 0,
                  allocationCoverageDays: null,
                },
              ]
            : [
                {
                  day: '2026-10-25',
                  historyCoverage: enabled ? 'current_day_partial' : 'not_enabled',
                  firstConfirmed: enabled ? 1 : null,
                  firstConfirmedValuePKR: enabled ? 1350 : null,
                  firstShipped: enabled ? 1 : null,
                  firstDelivered: enabled ? 0 : null,
                  collectedPKR: enabled ? 500.25 : null,
                  refundedPKR: enabled ? 100.01 : null,
                  netRecordedPKR: enabled ? 400.24 : null,
                },
              ],
          pagination: { page: Number(query.get('page') || 1), totalRows: 61, totalPages: 2 },
        },
      })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<html><head><style>body{margin:0}${css}</style></head><body><div id="root"></div></body></html>`,
    })
  })
  await page.goto('https://store.example/insights')
  await page.addScriptTag({ content: javascript })
  await expect(
    page.getByRole('heading', { name: 'Historical trends & stock inactivity' }),
  ).toBeVisible()
  return { queries }
}
test('setup is explicit and disabled sources stay unavailable rather than zero', async ({
  page,
}) => {
  await open(page, false, false)
  await page.getByRole('button', { name: 'Prepare insight indexes & exports' }).click()
  await page.getByRole('button', { name: 'Load insights', exact: true }).click()
  await expect(page.locator('.report-value').filter({ hasText: 'Unavailable' })).toHaveCount(7)
  await expect(page.getByText('not_enabled', { exact: true })).toBeVisible()
})
test('stock coverage and applied CSV filters remain explicit across pagination', async ({
  page,
}) => {
  const { queries } = await open(page)
  await page.getByLabel('Insight view').selectOption('stock')
  await page.getByLabel('Insight product ID (optional)').fill('product-1')
  await page.getByRole('button', { name: 'Load insights', exact: true }).click()
  await expect(page.getByText('partial_window', { exact: true })).toBeVisible()
  await expect(page.getByText('Original <script>safe</script> suit', { exact: true })).toBeVisible()
  expect(await page.locator('td script').count()).toBe(0)
  await page.getByLabel('Insight product ID (optional)').fill('unsaved-id')
  await page.getByRole('button', { name: 'Next insight page' }).click()
  expect(queries.at(-1)?.get('productId')).toBe('product-1')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export insights CSV (max 5,000)' }).click()
  await download
  expect(queries.at(-1)?.get('productId')).toBe('product-1')
})
test('failed insights remove stale summaries instead of showing false zeros', async ({ page }) => {
  await open(page)
  await page.getByLabel('Insight view').selectOption('stock')
  await page.getByRole('button', { name: 'Load insights', exact: true }).click()
  await expect(page.locator('.report-value')).not.toHaveCount(0)
  await page.getByLabel('Insight product ID (optional)').fill('error-id')
  await page.getByRole('button', { name: 'Load insights', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Insights temporarily unavailable')
  await expect(page.locator('.report-value')).toHaveCount(0)
})
test('mobile trends remain readable with horizontal scrolling confined to the table', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByRole('button', { name: 'Load insights', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await expect(page.getByText('current_day_partial', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/nski-insights-mobile.png', fullPage: true })
})
