import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Render the actual interactive components and theme CSS without a DB/app server.
let javascript = ''
let css = ''
test.beforeAll(async () => {
  const sourceRoot = fileURLToPath(new URL('../../src', import.meta.url))
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { ReelCarousel } from '@/components/home/ReelCarousel';
    import { CollectionLayout } from '@/components/products/CollectionLayout';
    import { CollectionHeading } from '@/components/products/CollectionHeading';
    import ${JSON.stringify(`${sourceRoot}/app/(app)/globals.css`)};
    createRoot(document.getElementById('root')).render(<>
      <header style={{height:112,display:'grid',placeItems:'center',borderBottom:'1px solid #648698'}}>Siblings by N’s KI — navigation placeholder</header>
      <main className="container my-4">
        <CollectionLayout search={<input aria-label="Search products" className="w-full h-11 border rounded-lg px-3" placeholder="Search products" />}
          filters={<><h2>Main Categories</h2><p>Winter Collection</p><h2>Subcategories</h2><p>Khaddar · Velvet</p><h2>Sort by</h2></>}>
          <CollectionHeading title="Winter Collection" count={12} description="Khaddar and velvet suits." />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1,2,3,4].map(id=><article key={id} aria-label={'Product '+id}>
              <div className="aspect-[2/3] rounded-lg border border-[#648698]/40 bg-[#648698]/20" />
              <p>Winter suit {id}</p><p>Rs. 3,500</p>
            </article>)}
          </div>
        </CollectionLayout>
        <section className="max-w-7xl mx-auto py-8"><h2>Shop by Video</h2>
          <ReelCarousel count={6}>{[1,2,3,4,5,6].map(id=><div key={id}
            className="flex-none min-w-[160px] sm:min-w-[220px] lg:min-w-[280px] w-[calc(50%-0.375rem)] lg:w-[calc(25%-1.125rem)] max-w-[320px] aspect-[9/16] border rounded-xl bg-[#648698]/20">Reel {id}</div>)}</ReelCarousel>
        </section>
      </main>
    </>);
  `
  const result = await build({
    configFile: false, logLevel: 'silent', resolve: { alias: { '@': sourceRoot } },
    esbuild: { jsx: 'automatic' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'isolated-ux-fixture', resolveId: id => id === 'virtual:ux' ? '\0ux-fixture.js' : undefined, load: id => id === '\0ux-fixture.js' ? ts.transpileModule(entry, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText : undefined }],
    build: { write: false, minify: false, cssCodeSplit: false, rollupOptions: { input: 'virtual:ux', output: { format: 'iife', name: 'StorefrontUXFixture' } } },
  })
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
  for (const output of outputs) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})

test('mobile collections show products early and keep filters behind a toggle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.setContent('<html data-theme="dark"><body><div id="root"></div></body></html>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: javascript })
  await expect(page.getByRole('heading', { name: 'Winter Collection' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Collection filters' })).not.toBeVisible()
  const product = await page.getByRole('article', { name: 'Product 1' }).boundingBox()
  expect(product!.y).toBeLessThan(350)
  await page.getByRole('button', { name: 'Filters & sort' }).click()
  await expect(page.getByRole('heading', { name: 'Subcategories' })).toBeVisible()
  await page.getByRole('button', { name: 'Show products' }).click()
  await expect(page.getByRole('complementary', { name: 'Collection filters' })).not.toBeVisible()
})

test('desktop keeps its sidebar and reel navigation works without hover or horizontal wheel scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<html data-theme="dark"><body><div id="root"></div></body></html>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: javascript })
  await expect(page.getByRole('complementary', { name: 'Collection filters' })).toBeVisible()
  const product = await page.getByRole('article', { name: 'Product 1' }).boundingBox()
  expect(product!.y).toBeLessThan(350)
  const track = page.getByRole('region', { name: 'Shop by Video reels' })
  await track.scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Next reels' })).toBeEnabled()
  await page.getByRole('button', { name: 'Next reels' }).click()
  await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Previous reels' })).toBeEnabled()
  await page.getByRole('button', { name: 'Previous reels' }).click()
  await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBe(0)
})
