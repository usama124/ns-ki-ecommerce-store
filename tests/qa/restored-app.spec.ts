import { test, expect, request as requests } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const baseURL = 'http://localhost:3105'
const tag = 'qa-audit-20261024'
// CLI requests omit Origin: the Docker ingress rewrites Next's internal origin.
// Browser-origin behavior is assessed separately, not bypassed in browser tests.
const headers = {}
let product: string
async function ready(page: import('@playwright/test').Page, path: string) {
  const hydrated = page.waitForResponse(response => response.url().endsWith('/api/users/me'))
  await page.goto(path)
  await hydrated
}
test.beforeAll(async () => {
  const api = await requests.newContext({ baseURL })
  const result = await api.get(`/api/products?where[slug][equals]=${tag}-suit&depth=0`)
  product = (await result.json()).docs[0]?.id
  expect(product).toBeTruthy()
  await api.dispose()
})
async function actor(role: string) {
  const api = await requests.newContext({ baseURL, extraHTTPHeaders: headers })
  const response = await api.post('/api/users/login', { data: { email: `${tag}-${role}@example.invalid`, password: 'SyntheticQA-Only#2026' } })
  expect(response.status()).toBe(200)
  return api
}
function order(method = 'cod', quantity = 1) {
  return { customer: { name: 'Synthetic QA Buyer', email: 'qa-buyer@example.invalid', phone: `0300${String(Date.now()).slice(-7)}`, city: 'Lahore', province: 'Punjab', address: '123 SYNTHETIC QA STREET' }, paymentMethod: method,
    items: [{ productId: product, variantSize: 'QA-M', quantity }], expectedTotal: quantity * 1000 + (method === 'cod' ? 350 : 250), paymentProof: method === 'cod' ? undefined : { transactionId: randomUUID().replaceAll('-', '').slice(0, 16) } }
}
test('QA-01 public catalog hides drafts and parent category includes child products', async ({ request }) => {
  const draft = await request.get(`/api/products?where[slug][equals]=${tag}-draft`)
  expect((await draft.json()).docs).toHaveLength(0)
  const category = await request.get(`/shop/${tag}`)
  expect(category.status()).toBe(200)
  expect((await category.text()).includes(`QA suit ${tag}`)).toBe(true)
})
test('QA-02 missing pages terminate with 404 rather than redirect loops', async ({ request }) => {
  for (const path of ['/qa-nonexistent-route', '/products/qa-nonexistent-product', '/shop/qa-nonexistent-category']) {
    const response = await request.get(path, { maxRedirects: 5 })
    // Next streaming notFound may send 200 plus noindex; never accept a redirect loop.
    expect([200, 404]).toContain(response.status())
    expect((await response.text()).includes('noindex')).toBe(true)
  }
})
test('QA-03 unauthenticated admin and order APIs deny access', async ({ request }) => {
  // /api/orders GET is deliberately shadowed by the custom POST-only route.
  expect((await request.get('/api/orders')).status()).toBe(405)
  expect([401, 403]).toContain((await request.post('/api/admin/orders/update-status', { headers, data: { orderIds: [product], status: 'cancelled' } })).status())
})
test('QA-04 checkout reprices tampered amounts and rejects fractional quantity', async ({ request }) => {
  const response = await request.post('/api/orders', { headers: { ...headers, 'Idempotency-Key': randomUUID() }, data: { ...order(), expectedTotal: 1 } })
  expect(response.status()).toBe(409)
  expect((await response.json()).quote.totalAmount).toBe(1350)
  expect((await request.post('/api/orders', { headers: { ...headers, 'Idempotency-Key': randomUUID() }, data: order('cod', 1.5) })).status()).toBe(400)
})
test('QA-05 COD checkout replay, ownership and cancel preserve inventory', async ({ request }) => {
  const customer = await actor('customer'), other = await actor('other'), admin = await actor('admin')
  try {
    const stock = async () => (await (await request.get(`/api/products/${product}?depth=0`)).json()).variants.find((v: { sku: string }) => v.sku === 'QA-suit-M').stock
    const before = await stock(), data = order(), key = randomUUID()
    const first = await customer.post('/api/orders', { headers: { 'Idempotency-Key': key }, data })
    expect(first.status()).toBe(200)
    const created = await first.json()
    const replay = await customer.post('/api/orders', { headers: { 'Idempotency-Key': key }, data })
    expect((await replay.json()).orderId).toBe(created.orderId)
    expect(await stock()).toBe(before - 1)
    expect((await customer.get(`/api/orders/${created.orderId}`)).status()).toBe(200)
    expect([403, 404]).toContain((await other.get(`/api/orders/${created.orderId}`)).status())
    for (let i = 0; i < 2; i++) expect((await admin.post('/api/admin/orders/update-status', { data: { orderIds: [created.orderId], status: 'cancelled' } })).status()).toBe(200)
    expect(await stock()).toBe(before)
  } finally { await customer.dispose(); await other.dispose(); await admin.dispose() }
})
for (const method of ['bank_transfer', 'jazzcash', 'easypaisa']) test(`QA-06 ${method} creates pending verification order without sending payments`, async () => {
  const customer = await actor('customer')
  try {
    const response = await customer.post('/api/orders', { headers: { 'Idempotency-Key': randomUUID() }, data: order(method) })
    expect(response.status()).toBe(200)
    const created = await response.json()
    const saved = await (await customer.get(`/api/orders/${created.orderId}?depth=0`)).json()
    expect(saved.status).toBe('pending_verification')
    expect(saved.totalAmount).toBe(1250)
  } finally { await customer.dispose() }
})
test('QA-07 admin quantity edit keeps financial totals consistent', async () => {
  const customer = await actor('customer'), admin = await actor('admin')
  try {
    const response = await customer.post('/api/orders', { headers: { 'Idempotency-Key': randomUUID() }, data: order() })
    expect(response.status()).toBe(200)
    const created = await response.json()
    const changed = await admin.patch(`/api/orders/${created.orderId}`, { data: { items: [{ product, variantSize: 'QA-M', quantity: 3, unitPrice: 1000 }] } })
    expect(changed.status()).toBe(200)
    const saved = await (await admin.get(`/api/orders/${created.orderId}?depth=0`)).json()
    expect(saved.totalAmount).toBe(saved.items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0) + saved.shippingFee + saved.codFee)
  } finally { await customer.dispose(); await admin.dispose() }
})
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort())
})
test('QA-08 desktop and mobile product view display add-to-bag controls', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/products/${tag}-suit`)
    await expect(page.getByRole('heading', { name: `QA suit ${tag}`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /add to bag/i }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
test('QA-09 corrupt cart storage does not crash storefront', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('nski_cart', '{}'))
  await page.goto('/')
  await page.waitForTimeout(2000)
  expect(errors.filter(error => /reduce|map|items/i.test(error))).toEqual([])
  await expect(page.getByRole('link', { name: 'Home', exact: true }).first()).toBeVisible()
})
test('QA-10 selected variant survives cart refresh and checkout entry on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page, `/products/${tag}-suit`)
  await page.getByRole('button', { name: 'QA-M', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Bag', exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nski_cart') || '[]').length)).toBe(1)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Open cart (1 items)', exact: true })).toBeVisible()
  await page.goto('/checkout')
  await expect(page.getByPlaceholder('e.g. Fatima Khan')).toBeVisible()
  for (const label of ['Full Name *', 'Phone Number (+92) *', 'Email Address (For Order Receipts)', 'City *', 'Province *', 'Street Address / House # / Area *']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByText(`QA suit ${tag}`, { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'reports/qa/test-artifacts/synthetic-mobile-checkout.png', fullPage: true })
})
test('QA-11 tracking is exact-match and returns no private customer information', async ({ request }) => {
  const input = order()
  const createdResponse = await request.post('/api/orders', { headers: { 'Idempotency-Key': randomUUID() }, data: input })
  expect(createdResponse.status()).toBe(200)
  const created = await createdResponse.json()
  const params = new URLSearchParams({ orderNumber: created.orderNumber, contact: input.customer.email })
  const tracked = await request.get(`/api/orders/track?${params}`)
  expect(tracked.status()).toBe(200)
  const data = await tracked.json()
  expect(data.order.status).toBe('confirmed')
  expect(data.order.customer).toBeUndefined()
  expect(data.order.items).toBeUndefined()
  expect(tracked.headers()['cache-control']).toContain('no-store')
  params.set('contact', 'wrong@example.invalid')
  expect((await request.get(`/api/orders/track?${params}`)).status()).toBe(404)
})
test('QA-12 private receipts reject anonymous and foreign users; missing test storage fails closed', async ({ request }) => {
  const customer = await actor('customer'), other = await actor('other')
  try {
    const response = await customer.post('/api/orders', { headers: { 'Idempotency-Key': randomUUID() }, data: order('bank_transfer') })
    expect(response.status()).toBe(200)
    const created = await response.json(), path = `/api/orders/${created.orderId}/receipt?info=1`
    expect((await request.get(path)).status()).toBe(404)
    expect((await other.get(path)).status()).toBe(404)
    expect((await customer.get(path)).status()).toBe(503)
    expect((await request.get(path, { headers: { 'x-order-token': created.accessToken } })).status()).toBe(503)
    expect((await request.get(path, { headers: { 'x-order-token': 'forged' } })).status()).toBe(404)
  } finally { await customer.dispose(); await other.dispose() }
})
test('QA-13 customer cannot use admin dashboards or forge a privileged role', async () => {
  const customer = await actor('customer'), admin = await actor('admin')
  try {
    for (const path of ['/api/admin/orders', '/api/inventory']) expect((await customer.get(path)).status()).toBe(403)
    const response = await customer.get('/api/users/me')
    const user = (await response.json()).user
    const update = await customer.patch(`/api/users/${user.id}`, { data: { roles: ['admin'] } })
    expect([200, 403]).toContain(update.status())
    // Roles are intentionally hidden from a customer's own response; inspect via admin.
    expect((await (await admin.get(`/api/users/${user.id}`)).json()).roles).not.toContain('admin')
    expect((await customer.get('/api/admin/orders')).status()).toBe(403)
    expect((await admin.get('/api/admin/orders')).status()).toBe(200)
  } finally { await customer.dispose(); await admin.dispose() }
})
test('QA-14 login rejects an off-site redirect after valid authentication', async ({ page }) => {
  const attempted: string[] = []
  await page.route('https://qa-external.invalid/**', route => { attempted.push(new URL(route.request().url()).origin); return route.abort() })
  await ready(page, '/login?redirect=https%3A%2F%2Fqa-external.invalid%2F')
  await page.getByLabel('Email', { exact: true }).fill(`${tag}-customer@example.invalid`)
  await page.getByLabel('Password', { exact: true }).fill('SyntheticQA-Only#2026')
  const login = page.waitForResponse(response => response.url().endsWith('/api/users/login'))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  expect((await login).status()).toBe(200)
  await page.waitForTimeout(1500)
  expect(attempted).toEqual([])
  await expect.poll(() => new URL(page.url()).pathname).toBe('/account')
})
test('QA-15 COD confirmation copy does not claim payment was received', async () => {
  const { getPaymentConfirmedCustomerEmailHtml } = await import('../../src/utilities/emailTemplates')
  const html = getPaymentConfirmedCustomerEmailHtml({ paymentMethod: 'cod', status: 'confirmed', orderNumber: '#NKI-000001', totalAmount: 1350, customer: { name: 'Synthetic QA' } }, baseURL)
  expect(html.includes('PAYMENT VERIFIED')).toBe(false)
  expect(html.includes('Total Paid:')).toBe(false)
})
for (const payment of [
  { method: 'cod', label: '' },
  { method: 'bank_transfer', label: 'Bank / Raast Transfer' },
  { method: 'jazzcash', label: 'JazzCash Wallet' },
  { method: 'easypaisa', label: 'EasyPaisa Wallet' },
]) test(`QA-16 mobile guest completes ${payment.method} checkout and sees confirmation`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page, `/products/${tag}-suit`)
  await page.getByRole('button', { name: 'QA-M', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Bag', exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nski_cart') || '[]').length)).toBe(1)
  await page.goto('/checkout')
  await page.getByPlaceholder('e.g. Fatima Khan').fill('Synthetic Browser Buyer')
  await page.getByPlaceholder('e.g. 03001234567').fill(`0300${String(Date.now()).slice(-7)}`)
  await page.getByPlaceholder('fatima@example.com').fill('qa-browser@example.invalid')
  await page.getByPlaceholder('House No, Street, Sector/Block, LandMark').fill('123 SYNTHETIC QA STREET')
  if (payment.method !== 'cod') {
    await page.getByRole('button', { name: new RegExp(payment.label) }).click()
    await page.getByLabel('Transaction / Reference ID (TRX ID)', { exact: true }).fill(`QA${Date.now()}`)
  }
  const response = page.waitForResponse(response => response.url().endsWith('/api/orders') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Complete Order' }).click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Thank You', exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nski_cart') || '[]').length)).toBe(0)
})
test('QA-17 administrator sees report pagination and explicit inventory scope', async ({ page }) => {
  const admin = await actor('admin')
  try {
    await page.context().addCookies((await admin.storageState()).cookies)
    await page.goto('/store-admin/orders-dashboard')
    await expect(page.getByRole('navigation', { name: 'Order report pages' })).toBeVisible()
    await expect(page.getByText('Confirmed Order Value (All Time, Not Collected Cash)', { exact: true })).toBeVisible()
    await page.goto('/store-admin/inventory')
    await expect(page.getByRole('navigation', { name: 'Inventory product pages' })).toBeVisible()
    await expect(page.getByText('Variants on Page', { exact: true })).toBeVisible()
    await expect(page.getByText('Counts, search and stock filters below apply to this page only. Save changes before changing pages.', { exact: true })).toBeVisible()
  } finally { await admin.dispose() }
})

test('QA-18 Reports loads in the actual admin shell and current inventory is date-independent', async ({ page }) => {
  const admin = await actor('admin')
  try {
    await page.context().addCookies((await admin.storageState()).cookies)
    await page.goto('/store-admin/reports')
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Orders placed', exact: true })).toBeVisible()
    // Payload mounts its own empty global alert region; scope errors to Reports.
    await expect(page.locator('.nski-reports').getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: 'Products', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Products with zero orders', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Inventory', exact: true }).click()
    await expect(page.getByText('Current stock as of request time; not historical stock')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Stock units now', exact: true })).toBeVisible()
    await expect(page.locator('.nski-reports').getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: '/tmp/nski-reports-admin-desktop.png', fullPage: true })
  } finally { await admin.dispose() }
})

test('QA-19 report JSON, CSV, suggestions and preparation reject guests and customers', async ({ request }) => {
  for (const path of ['/api/admin/reports', '/api/admin/reports?format=csv', '/api/admin/reports/options']) expect((await request.get(path)).status()).toBe(401)
  expect((await request.post('/api/admin/reports/initialize')).status()).toBe(401)
  const customer = await actor('customer')
  try {
    for (const path of ['/api/admin/reports', '/api/admin/reports?format=csv', '/api/admin/reports/options']) expect((await customer.get(path)).status()).toBe(403)
    expect((await customer.post('/api/admin/reports/initialize')).status()).toBe(403)
  } finally { await customer.dispose() }
})

test('QA-20 report exports initialize explicitly, contain all matching rows and exclude private fields', async () => {
  const admin = await actor('admin')
  try {
    expect((await admin.post('/api/admin/reports/initialize')).status()).toBe(200)
    const report = await admin.get('/api/admin/reports?view=orders&start=2026-10-01&end=2026-10-25')
    expect(report.status()).toBe(200)
    const data = await report.json()
    const exported = await admin.get('/api/admin/reports?view=orders&start=2026-10-01&end=2026-10-25&format=csv')
    expect(exported.status()).toBe(200)
    expect(exported.headers()['cache-control']).toBe('private, no-store')
    const csv = await exported.text()
    expect(csv.trim().split('\r\n')).toHaveLength(data.pagination.totalRows + 1)
    expect(csv).not.toMatch(/qa-buyer@example|0300\d{7}|SYNTHETIC QA STREET|transactionId|receipt|email|phone/i)
  } finally { await admin.dispose() }
})

test('QA-21 admin enables history and captures consistent baselines without inventing old events', async ({ page }) => {
  const admin = await actor('admin')
  try {
    await page.context().addCookies((await admin.storageState()).cookies)
    await page.goto('/store-admin/reports')
    await page.getByText('Order history, first milestones & stock ledger', { exact: true }).click()
    const enable = page.getByRole('button', { name: 'Enable order & stock history' })
    await expect(page.getByRole('heading', { name: 'Historical operations', exact: true })).toBeVisible()
    const before = await admin.get('/api/admin/operations/status')
    if (!(await before.json()).ready) await enable.click()
    await page.getByRole('button', { name: 'Capture next 25 product baselines' }).click()
    await expect(page.locator('section[aria-label="Historical operations"]').getByRole('status')).toContainText('Scan complete')
    const state = await (await admin.get('/api/admin/operations/status')).json()
    expect(state.currentVariants).toBeGreaterThan(0)
    expect(state.trackedVariants).toBe(state.currentVariants)
    expect(state.driftedVariants).toBe(0)
    await page.getByLabel('History source').selectOption('stock')
    await page.getByRole('button', { name: 'Load history', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Export history CSV (max 5,000)' })).toBeVisible()
    await expect(page.locator('section[aria-label="Historical operations"]').getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: '/tmp/nski-history-admin.png', fullPage: true })
  } finally { await admin.dispose() }
})

test('QA-22 operations history/setup/backfill deny guests and customers', async ({ request }) => {
  for (const path of ['/api/admin/operations', '/api/admin/operations?source=stock&format=csv', '/api/admin/operations/status']) expect((await request.get(path)).status()).toBe(401)
  for (const path of ['/api/admin/operations/initialize', '/api/admin/operations/baseline']) expect((await request.post(path, { data: {} })).status()).toBe(401)
  const customer = await actor('customer')
  try {
    for (const path of ['/api/admin/operations', '/api/admin/operations?source=stock&format=csv', '/api/admin/operations/status']) expect((await customer.get(path)).status()).toBe(403)
    for (const path of ['/api/admin/operations/initialize', '/api/admin/operations/baseline']) expect((await customer.post(path, { data: {} })).status()).toBe(403)
  } finally { await customer.dispose() }
})

test('QA-23 actual admin shell records private synthetic collections/refunds without changing order status', async ({ page, request }) => {
  const admin = await actor('admin')
  try {
    expect((await admin.post('/api/admin/payments/initialize')).status()).toBe(200)
    const response = await request.post('/api/orders', { headers: { 'Idempotency-Key': randomUUID() }, data: order() })
    expect(response.status()).toBe(200)
    const created = await response.json()
    const payment = { key: randomUUID(), orderId: String(created.orderId), kind: 'collection', amount: '500.25', method: 'cash', reason: 'customer_payment', occurredAt: new Date().toISOString() }
    expect((await admin.post('/api/admin/payments', { data: payment })).status()).toBe(200)
    const replay = await admin.post('/api/admin/payments', { data: payment })
    expect((await replay.json()).replayed).toBe(true)
    expect((await admin.post('/api/admin/payments', { data: { ...payment, key: randomUUID(), kind: 'refund', reason: 'return', amount: '100.01', refundOf: payment.key, occurredAt: new Date().toISOString() } })).status()).toBe(200)
    const before = await admin.get(`/api/admin/payments?orderId=${created.orderId}`)
    expect((await before.json()).summary).toMatchObject({ records: 2, collectedMinor: 50025, refundedMinor: 10001, netMovementMinor: 40024 })
    const exported = await admin.get(`/api/admin/payments?orderId=${created.orderId}&format=csv`)
    const csv = await exported.text()
    expect(exported.status()).toBe(200)
    expect(csv).not.toMatch(/qa-buyer@example|SYNTHETIC QA STREET|fingerprint|receipt|paymentProof|transactionId/)
    await page.context().addCookies((await admin.storageState()).cookies)
    await page.goto('/store-admin/reports')
    await page.getByText('Recorded payments & refunds (actual money)', { exact: true }).click()
    await page.getByLabel('Money order ID (optional)').fill(String(created.orderId))
    await page.getByRole('button', { name: 'Load money report', exact: true }).click()
    const panel = page.locator('section[aria-label="Recorded payments and refunds"]')
    await expect(panel.getByRole('heading', { name: /confirmed/ })).toBeVisible()
    await expect(panel.getByRole('alert')).toHaveCount(0)
    await expect(panel.getByText('All-time recorded for this order:', { exact: false })).toContainText('500.25')
    await page.screenshot({ path: '/tmp/nski-money-admin.png', fullPage: true })
  } finally { await admin.dispose() }
})

test('QA-24 payment report/record/setup deny guests and customers', async ({ request }) => {
  for (const path of ['/api/admin/payments', '/api/admin/payments?format=csv', '/api/admin/payments/status']) expect((await request.get(path)).status()).toBe(401)
  for (const path of ['/api/admin/payments', '/api/admin/payments/initialize']) expect((await request.post(path, { data: {} })).status()).toBe(401)
  const customer = await actor('customer')
  try {
    for (const path of ['/api/admin/payments', '/api/admin/payments?format=csv', '/api/admin/payments/status']) expect((await customer.get(path)).status()).toBe(403)
    for (const path of ['/api/admin/payments', '/api/admin/payments/initialize']) expect((await customer.post(path, { data: {} })).status()).toBe(403)
  } finally { await customer.dispose() }
})
