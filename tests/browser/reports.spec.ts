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
        name: 'report-fixture',
        resolveId: (id) => (id === 'virtual:entry' ? '\0' + id : undefined),
        load: (id) =>
          id === '\0virtual:entry'
            ? `import React,{StrictMode}from'react';import{createRoot}from'react-dom/client';import{ReportsClient}from'@/components/admin/ReportsView/ReportsClient';createRoot(document.getElementById('root')).render(React.createElement(StrictMode,null,React.createElement(ReportsClient)));`
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: 'virtual:entry', output: { format: 'iife', name: 'ReportQA' } },
    },
  })
  for (const output of 'output' in result ? result.output : []) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})
async function open(page: Page, ready = true) {
  const requests: URLSearchParams[] = []
  let exportReady = ready
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'store.example') return route.abort()
    if (url.pathname === '/api/admin/reports/options')
      return route.fulfill({
        json: { products: [{ id: 'p1', title: 'Test product' }], categories: [], limited: false },
      })
    if (url.pathname === '/api/admin/reports/initialize') {
      exportReady = true
      return route.fulfill({ json: { ready: true } })
    }
    if (url.pathname === '/api/admin/reports') {
      const search = url.searchParams
      requests.push(search)
      if (search.get('format') === 'csv') {
        if (search.get('city') === 'Too Many')
          return route.fulfill({
            status: 413,
            json: { error: 'Export exceeds 5000 rows. Narrow the filters.' },
          })
        return route.fulfill({
          contentType: 'text/csv',
          headers: { 'Content-Disposition': 'attachment; filename="test.csv"' },
          body: 'id,total\r\n1,1350\r\n',
        })
      }
      if (search.get('city') === 'Broken')
        return route.fulfill({
          status: 503,
          json: { error: 'The request could not be completed. Please try again.' },
        })
      const view = search.get('view') || 'overview',
        currentPage = Number(search.get('page') || 1)
      const inventory = view === 'inventory',
        product = view === 'products'
      const empty = search.get('city') === 'No Orders'
      return route.fulfill({
        json: {
          filters: {
            view,
            start: search.get('start') || '2026-10-01',
            end: search.get('end') || '2026-10-25',
            status: search.get('status') || (product ? 'accepted' : 'all'),
            payment: 'all',
            product: '',
            category: '',
            city: search.get('city') || '',
            courier: '',
            stock: 'all',
            threshold: 5,
            sort: search.get('sort') || 'newest',
            page: currentPage,
          },
          generatedAt: '2026-10-25T10:00:00Z',
          dateBasis: inventory
            ? 'Current stock as of request time; not historical stock'
            : 'Order placed-at cohort · Asia/Karachi (UTC+05:00)',
          definition: inventory
            ? 'Backorder permission is not stock.'
            : 'Accepted value is not collected cash. Full matching totals.',
          summary: empty
            ? { orders: 0, averageAcceptedValue: null, cancellationRate: null }
            : inventory
              ? { variants: 610, stockUnits: 6072, unknownStock: 1, retailStockValue: 6070000 }
              : product
                ? { products: 3, units: 4, merchandiseValue: 3100, zeroOrderProducts: 1 }
                : { orders: 51, acceptedValue: 68850 },
          comparison: inventory || product ? null : { orders: { absolute: 51, percent: null } },
          trend: [],
          breakdowns: { status: [], payment: [], courier: [] },
          rows: empty
            ? []
            : inventory
              ? [
                  {
                    id: 'p1',
                    title: 'Test product',
                    stock: null,
                    stockState: 'unknown',
                    size: 'M',
                    backorder: true,
                    price: 0,
                  },
                ]
              : product
                ? [{ id: 'p1', title: 'Zero-order suit', units: 0, orders: 0, merchandiseValue: 0 }]
                : [
                    {
                      id: String(currentPage),
                      orderNumber: `QA-PAGE-${currentPage}`,
                      createdAt: '2026-10-25T10:00:00Z',
                      status: 'confirmed',
                      paymentMethod: 'cod',
                      total: 1350,
                    },
                  ],
          pagination: {
            page: currentPage,
            totalPages: empty || inventory || product ? 1 : 2,
            totalRows: empty ? 0 : inventory ? 610 : product ? 3 : 51,
            pageSize: 50,
          },
          unavailable: ['Collected cash, refunds and profit are not recorded.'],
          exportReady,
        },
      })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<html><head><style>body{margin:0}${css}</style></head><body><div id="root"></div></body></html>`,
    })
  })
  await page.goto('https://store.example/store-admin/reports')
  await page.addScriptTag({ content: javascript })
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  return requests
}
test('global totals stay independent of pages; pagination ignores unapplied draft filters', async ({
  page,
}) => {
  const requests = await open(page)
  await expect(page.getByRole('heading', { name: 'Details · 51 matching orders' })).toBeVisible()
  await expect(
    page.getByText('percentage unavailable (prior zero)', { exact: false }),
  ).toBeVisible()
  await page.getByLabel('City (exact match)').fill('Unapplied draft')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('QA-PAGE-2')).toBeVisible()
  expect(requests.at(-1)?.get('city')).toBeNull()
  await expect(page.getByRole('heading', { name: 'Details · 51 matching orders' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open record' })).toHaveAttribute(
    'href',
    '/store-admin/collections/orders/2',
  )
})
test('product and inventory tabs use meaningful defaults and expose missing metrics honestly', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Products', exact: true }).click()
  await expect(page.getByLabel('Current order status')).toHaveValue('accepted')
  await expect(page.getByText('Zero-order suit')).toBeVisible()
  await page.getByRole('button', { name: 'Inventory', exact: true }).click()
  await expect(
    page.getByText('Current stock as of request time; not historical stock'),
  ).toBeVisible()
  await expect(page.getByLabel('From (Karachi)')).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Unknown', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Retail stock value (not cost)' })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('Zero-order suit')).toBeVisible()
})
test('failed reports do not retain stale values or present zero as success', async ({ page }) => {
  await open(page)
  await page.getByLabel('City (exact match)').fill('Broken')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('alert')).toContainText('Report unavailable')
  await expect(page.getByRole('heading', { name: 'Currently accepted order value' })).toHaveCount(0)
  await expect(page.locator('section[aria-label="Report summary"]')).toHaveCount(0)
})
test('exports require setup; download all-result mode and report explicit oversize errors', async ({
  page,
}) => {
  const requests = await open(page, false)
  await page.getByRole('button', { name: 'Prepare reporting indexes & exports' }).click()
  await expect(page.getByRole('button', { name: 'Export all matching rows (CSV)' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all matching rows (CSV)' }).click()
  await download
  expect(requests.at(-1)?.get('format')).toBe('csv')
  expect(requests.at(-1)?.get('page')).toBe('1')
  await page.getByLabel('City (exact match)').fill('Too Many')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('button', { name: 'Export all matching rows (CSV)' })).toBeVisible()
  await page.getByRole('button', { name: 'Export all matching rows (CSV)' }).click()
  await expect(page.getByRole('status')).toContainText('Export exceeds 5000 rows')
})
test('mobile report controls remain readable without document-width overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await expect(page.getByLabel('Product ID')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: '/tmp/nski-reports-mobile.png', fullPage: true })
})
test('empty reports show unavailable rates rather than invented zero averages', async ({
  page,
}) => {
  await open(page)
  await page.getByLabel('City (exact match)').fill('No Orders')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('heading', { name: 'Details · 0 matching orders' })).toBeVisible()
  await expect(page.getByText('Unavailable (no denominator)', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
