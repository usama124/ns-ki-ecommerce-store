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
        name: 'operation-fixture',
        resolveId: (id) => (id === 'virtual:entry' ? '\0' + id : undefined),
        load: (id) =>
          id === '\0virtual:entry'
            ? `import React from'react';import{createRoot}from'react-dom/client';import{OperationsPanel}from'@/components/admin/ReportsView/OperationsPanel';import'@/components/admin/ReportsView/reports.css';createRoot(document.getElementById('root')).render(React.createElement('main',{className:'nski-reports'},React.createElement(OperationsPanel)));`
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: 'virtual:entry', output: { format: 'iife', name: 'OpsQA' } },
    },
  })
  for (const output of 'output' in result ? result.output : []) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})
async function open(page: Page, initialized = true) {
  let ready = initialized,
    batches = 0
  const requests: URLSearchParams[] = [],
    cursors: string[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'store.example') return route.abort()
    if (url.pathname.endsWith('/status'))
      return route.fulfill({
        json: {
          ready,
          coverageStartedAt: '2026-10-25T09:00:00Z',
          currentVariants: 27,
          trackedVariants: batches === 2 ? 27 : batches === 1 ? 25 : 0,
          driftedVariants: 0,
        },
      })
    if (url.pathname.endsWith('/initialize')) {
      ready = true
      return route.fulfill({ json: { ready: true } })
    }
    if (url.pathname.endsWith('/baseline')) {
      cursors.push(route.request().postDataJSON().cursor)
      batches++
      return route.fulfill({
        json: { processed: batches === 1 ? 25 : 2, nextCursor: batches === 1 ? 'next-25' : null },
      })
    }
    if (url.pathname === '/api/admin/operations') {
      const search = url.searchParams
      requests.push(search)
      if (search.get('orderId') === 'error-id')
        return route.fulfill({ status: 503, json: { error: 'History temporarily unavailable.' } })
      if (search.get('format') === 'csv')
        return route.fulfill({
          contentType: 'text/csv',
          body: 'recordedAt,total\r\n2026-10-25,1350\r\n',
        })
      const source = search.get('source') || 'orders',
        page = Number(search.get('page') || 1)
      return route.fulfill({
        json: {
          filters: { ...Object.fromEntries(search), source, format: 'json' },
          dateBasis:
            source === 'milestones'
              ? 'Recorded firstConfirmedAt · Asia/Karachi · orders tracked since creation only'
              : 'Event recorded-at · Asia/Karachi; not order placement date',
          rows: [
            {
              id: `history-${page}`,
              orderId: 'order-1',
              recordedAt: '2026-10-25T09:00:00Z',
              kind: 'status_changed',
              currentStatus: 'cancelled',
              total: 1350,
              ...(search.get('orderId')
                ? { items: [{ title: 'Original <script>safe</script> suit', unitPrice: 1000 }] }
                : {}),
            },
          ],
          summary: { records: 51, netStockChange: -1, openingRows: 1, confirmedValue: 1350 },
          pagination: { page, totalRows: 51, totalPages: 2 },
        },
      })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<html><head><style>body{margin:0}${css}</style></head><body><div id="root"></div></body></html>`,
    })
  })
  await page.goto('https://store.example/operations')
  await page.addScriptTag({ content: javascript })
  await expect(page.getByRole('heading', { name: 'Historical operations' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Checking tracking coverage…' })).toHaveCount(0)
  return { requests, cursors }
}
test('setup is explicit and baseline batches resume without pretending to reconstruct history', async ({
  page,
}) => {
  const { cursors } = await open(page, false)
  await page.getByRole('button', { name: 'Enable order & stock history' }).click()
  await expect(
    page.getByRole('button', { name: 'Capture next 25 product baselines' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Capture next 25 product baselines' }).click()
  await expect(page.getByRole('status')).toContainText('Capture the next batch')
  await page.getByRole('button', { name: 'Capture next 25 product baselines' }).click()
  await expect(page.getByRole('status')).toContainText('Scan complete')
  expect(cursors).toEqual(['', 'next-25'])
  await expect(
    page.getByText('Baselines: 27 of 27 current variants.', { exact: false }),
  ).toBeVisible()
})
test('first milestones remain historical accepted value and CSV uses applied filters', async ({
  page,
}) => {
  const { requests } = await open(page)
  await page.getByLabel('History source').selectOption('milestones')
  await page.getByLabel('History order ID').fill('order-1')
  await page.getByRole('button', { name: 'Load history', exact: true }).click()
  await expect(
    page.getByText('This is historical accepted value, not collected cash', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('cell', { name: 'cancelled', exact: true })).toBeVisible()
  await page.getByLabel('History order ID').fill('unsaved-id')
  await page.getByRole('button', { name: 'Next history page' }).click()
  expect(requests.at(-1)?.get('orderId')).toBe('order-1')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export history CSV (max 5,000)' }).click()
  await downloaded
  expect(requests.at(-1)?.get('orderId')).toBe('order-1')
  expect(requests.at(-1)?.get('page')).toBe('1')
})
test('history errors remove stale data and snapshots render only as text', async ({ page }) => {
  await open(page)
  await page.getByLabel('History order ID').fill('order-1')
  await page.getByRole('button', { name: 'Load history', exact: true }).click()
  await page.getByText('Order item snapshots (recorded facts)', { exact: true }).click()
  await expect(page.locator('pre')).toContainText('Original <script>safe</script> suit')
  expect(await page.locator('pre script').count()).toBe(0)
  await page.getByLabel('History order ID').fill('error-id')
  await page.getByRole('button', { name: 'Load history', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('History temporarily unavailable')
  await expect(page.getByRole('button', { name: 'Export history CSV (max 5,000)' })).toHaveCount(0)
})
