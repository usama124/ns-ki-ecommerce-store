import { test, expect, type Page } from '@playwright/test'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

let javascript = ''
test.beforeAll(async () => {
  const entry = `
    import React,{StrictMode} from 'react';import{createRoot}from'react-dom/client';
    import {Analytics} from '@/components/Analytics';import{ProductView}from'@/components/Analytics/ProductView';
    import{CheckoutView}from'@/components/Analytics/CheckoutView';import{ProductGrid}from'@/components/products/ProductGrid';
    import{CartProvider,useCart}from'@/providers/Cart';import{usePathname}from'next/navigation';
    import{captureOrderAnalytics}from'@/lib/analytics/client';
    const product={id:'qa-product',title:'Synthetic QA suit',slug:'qa-suit',basePricePKR:1000};
    function go(path){history.pushState({},'',path);window.dispatchEvent(new Event('qa-navigation'))}
    function Shop(){const cart=useCart(),path=usePathname();const[attribution,setAttribution]=React.useState('');return React.createElement(React.Fragment,null,
      React.createElement('button',{onClick:async()=>setAttribution(JSON.stringify(await captureOrderAnalytics())||'none')},'Capture attribution'),
      React.createElement('output',{'data-attribution':true},attribution),
      React.createElement('span',{'data-count':true},String(cart.itemCount)),
      React.createElement('button',{onClick:()=>cart.addItem({productId:product.id,title:product.title,slug:product.slug,variantSize:'M',price:1000,stock:3})},'Add synthetic product'),
      React.createElement('button',{onClick:()=>cart.clearCart()},'Clear after checkout'),
      React.createElement('button',{onClick:()=>go('/checkout')},'Go checkout'),
      React.createElement('button',{onClick:()=>go('/shop?email=private%40example.invalid&token=private-token')},'Change query'),
      React.createElement('button',{onClick:()=>go('/orders/private-id?token=private-token')},'Private page'),
      path.startsWith('/products/')?React.createElement(ProductView,{product}):React.createElement(ProductGrid,{products:[product],listId:'qa_list'}),
      path==='/checkout'?React.createElement(CheckoutView,{items:cart.items}):null)}
    createRoot(document.getElementById('root')).render(React.createElement(StrictMode,null,React.createElement(Analytics,{deploymentAllowed:true}),React.createElement(CartProvider,null,React.createElement(Shop))));
  `
  const navigation = `import{useSyncExternalStore}from'react';const sub=cb=>{window.addEventListener('qa-navigation',cb);return()=>window.removeEventListener('qa-navigation',cb)};export const usePathname=()=>useSyncExternalStore(sub,()=>location.pathname,()=>'/');export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(sub,()=>location.search,()=>''));`
  const link = `import React from'react';export default function Link({href,children,onClick,...props}){return React.createElement('a',{...props,href,onClick:e=>{onClick?.(e);e.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('qa-navigation'))}},children)}`
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    define: {
      'process.env': JSON.stringify({
        NODE_ENV: 'production',
        NEXT_PUBLIC_ANALYTICS_ENABLED: 'true',
        NEXT_PUBLIC_GA4_ID: 'G-TEST123',
        NEXT_PUBLIC_SERVER_URL: 'https://store.example',
      }),
    },
    resolve: {
      alias: [
        { find: 'next/navigation', replacement: 'virtual:navigation' },
        { find: 'next/link', replacement: 'virtual:link' },
        { find: '@', replacement: fileURLToPath(new URL('../../src', import.meta.url)) },
      ],
    },
    plugins: [
      {
        name: 'analytics-qa',
        resolveId: (id) => (id.startsWith('virtual:') ? '\0' + id : undefined),
        load: (id) =>
          id === '\0virtual:analytics'
            ? entry
            : id === '\0virtual:navigation'
              ? navigation
              : id === '\0virtual:link'
                ? link
                : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: 'virtual:analytics',
        output: { format: 'iife', name: 'AnalyticsQA' },
      },
    },
  })
  for (const output of 'output' in result ? result.output : [])
    if (output.type === 'chunk') javascript += output.code
})
async function open(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'store.example')
      return route.fulfill({
        contentType: 'text/html',
        body: '<html><body><div id="root"></div></body></html>',
      })
    if (url.hostname === 'www.googletagmanager.com')
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__qaLoaderCount=(window.__qaLoaderCount||0)+1',
      })
    return route.abort()
  })
  await page.goto('https://store.example/shop?token=private-token&email=private%40example.invalid')
  await page.addScriptTag({ content: javascript })
}
async function events(page: Page) {
  return page.evaluate(() =>
    (window.dataLayer || [])
      .map((value) => Array.from(value as ArrayLike<unknown>))
      .filter((value) => value[0] === 'event'),
  )
}
test('GA identifiers require consent and a withdrawal capability; reject revokes pending server tracking', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Capture attribution' }).click()
  await expect(page.locator('[data-attribution]')).toHaveText('none')
  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await page.evaluate(() => {
    const original = window.gtag
    window.gtag = (...args: unknown[]) => {
      if (args[0] === 'get')
        (args[3] as (value: string) => void)(args[2] === 'client_id' ? '123.456' : '1234567890')
      else original?.(...args)
    }
  })
  await page.getByRole('button', { name: 'Capture attribution' }).click()
  await expect(page.locator('[data-attribution]')).toContainText('123.456')
  const captured = JSON.parse(await page.locator('[data-attribution]').innerText())
  expect(captured.token).toMatch(/^[a-f0-9]{64}$/)
  const revocation = page.waitForRequest((request) =>
    request.url().endsWith('/api/analytics/revoke'),
  )
  await page.getByRole('button', { name: 'Cookie settings' }).click()
  await page.getByRole('button', { name: 'Reject analytics' }).click()
  expect((await revocation).postDataJSON()).toEqual({ token: captured.token })
  await page.getByRole('button', { name: 'Capture attribution' }).click()
  await expect(page.locator('[data-attribution]')).toHaveText('none')
})
test('analytics opt-in does not replay denied actions; loader and quantity events are single-owned', async ({
  page,
}) => {
  await open(page)
  await expect(page.getByRole('region', { name: 'Analytics preferences' })).toBeVisible()
  expect(await page.locator('#nski-analytics-loader').count()).toBe(0)
  await page.getByRole('button', { name: 'Reject analytics' }).click()
  await page.getByRole('button', { name: 'Add synthetic product' }).click()
  await expect(page.locator('[data-count]')).toHaveText('1')
  expect(await events(page)).toHaveLength(0)
  await page.getByRole('button', { name: 'Cookie settings' }).click()
  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect
    .poll(async () => (await events(page)).filter((event) => event[1] === 'page_view').length)
    .toBe(1)
  await page.getByRole('button', { name: 'Add synthetic product' }).click()
  await expect(page.locator('[data-count]')).toHaveText('2')
  const added = (await events(page)).filter((event) => event[1] === 'add_to_cart')
  expect(added).toHaveLength(1)
  expect(added[0][2]).toMatchObject({ value: 1000, items: [{ quantity: 1 }] })
  await expect(page.locator('#nski-analytics-loader')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear after checkout' }).click()
  expect((await events(page)).filter((event) => event[1] === 'remove_from_cart')).toHaveLength(0)
})
test('visible list, selection, product view and checkout use stable item IDs without private URL data', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect
    .poll(async () => (await events(page)).filter((event) => event[1] === 'view_item_list').length)
    .toBe(1)
  await page.getByRole('link', { name: 'Synthetic QA suit', exact: true }).click()
  await expect
    .poll(async () => (await events(page)).filter((event) => event[1] === 'view_item').length)
    .toBe(1)
  await page.getByRole('button', { name: 'Add synthetic product' }).click()
  await page.getByRole('button', { name: 'Go checkout' }).click()
  await expect
    .poll(async () => (await events(page)).filter((event) => event[1] === 'begin_checkout').length)
    .toBe(1)
  const captured = await events(page)
  expect(captured.filter((event) => event[1] === 'select_item')).toHaveLength(1)
  for (const event of captured) {
    const payload = event[2] as { items?: { item_id: string }[] }
    for (const item of payload.items || []) expect(item.item_id).toBe('qa-product')
  }
  expect(JSON.stringify(captured)).not.toMatch(/private-token|email=|private%40|private@example/)
})
test('manual page views cover query navigation once; private routes and revoked consent stop collection', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect
    .poll(async () => (await events(page)).filter((event) => event[1] === 'page_view').length)
    .toBe(1)
  await page.getByRole('button', { name: 'Change query' }).click()
  await expect
    .poll(async () => (await events(page)).filter((event) => event[1] === 'page_view').length)
    .toBe(2)
  await page.getByRole('button', { name: 'Private page' }).click()
  await page.getByRole('button', { name: 'Add synthetic product' }).click()
  expect((await events(page)).filter((event) => event[1] === 'page_view')).toHaveLength(2)
  expect((await events(page)).filter((event) => event[1] === 'add_to_cart')).toHaveLength(0)
  await page.getByRole('button', { name: 'Cookie settings' }).click()
  await page.getByRole('button', { name: 'Reject analytics' }).click()
  expect(await events(page)).toHaveLength(0)
})
