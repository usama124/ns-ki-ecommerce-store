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
    import { ShopByVideo } from '@/components/home/ShopByVideo';
    import { ProductGrid } from '@/components/products/ProductGrid';
    import { CartProvider } from '@/providers/Cart';
    import ${JSON.stringify(`${sourceRoot}/app/(app)/globals.css`)};
    const products = Array.from({length:6}, (_,i)=>({id:String(i),title:'Winter suit '+i,slug:'suit-'+i,basePricePKR:3500,variants:[{size:'Unstitched',stock:5}]}));
    createRoot(document.getElementById('root')).render(React.createElement(CartProvider,null,
      React.createElement('section',{id:'featured',className:'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8'},React.createElement(ProductGrid,{products})),
      React.createElement(ShopByVideo,{reels:products.map(product=>({id:product.id,title:'Winter reel',linkedProduct:product}))})
    ));
  `
  const result = await build({
    configFile: false, logLevel: 'silent', resolve: { alias: { '@': sourceRoot } },
    esbuild: { jsx: 'automatic' }, define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
    plugins: [{ name: 'homepage-fixture', resolveId: id => id === 'virtual:home' ? '\0home.js' : undefined, load: id => id === '\0home.js' ? entry : undefined }],
    build: { write: false, minify: false, cssCodeSplit: false, rollupOptions: { input: 'virtual:home', output: { format: 'iife', name: 'HomepageFixture' } } },
  })
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
  for (const output of outputs) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})

for (const width of [375, 640, 768, 1024, 1440]) {
  test(`homepage reels match featured product widths at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.setContent('<html><body><div id="root"></div></body></html>')
    await page.addStyleTag({ content: css })
    await page.addScriptTag({ content: javascript })
    const product = page.locator('#featured .grid > div').first()
    const reel = page.getByRole('region', { name: 'Shop by Video reels' }).locator(':scope > div').first()
    await expect(product).toBeVisible()
    await reel.scrollIntoViewIfNeeded()
    const productBox = (await product.boundingBox())!
    const reelBox = (await reel.boundingBox())!
    expect(Math.abs(productBox.width - reelBox.width)).toBeLessThan(1)
    expect(Math.abs(productBox.x - reelBox.x)).toBeLessThan(1)
    expect(reelBox.height / reelBox.width).toBeCloseTo(4 / 3, 1)
    await expect(page.getByRole('button', { name: 'Next reels' })).toBeEnabled()
    const quickShop = reel.getByRole('button', { name: 'Quick Shop' })
    const buttonBox = (await quickShop.boundingBox())!
    expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(reelBox.x + reelBox.width)
    await quickShop.click()
    await expect(page.getByText('Quick Add', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).click()
  })
}
