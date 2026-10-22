import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../src/utilities/responsiveMedia.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const moduleURL = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`

for (const scenario of [
  { name: 'mobile card at 1x', viewport: 400, dpr: 1, sizes: '50vw', expected: 300 },
  { name: 'mobile card at 2x', viewport: 400, dpr: 2, sizes: '50vw', expected: 600 },
  { name: 'desktop card at 2x', viewport: 1440, dpr: 2, sizes: '300px', expected: 600 },
  { name: 'gallery at 2x', viewport: 1440, dpr: 2, sizes: '440px', expected: 1600 },
  { name: 'gallery thumbnail at 2x', viewport: 1440, dpr: 2, sizes: '80px', expected: 300 },
]) {
  test(`browser selects the stored ${scenario.expected}px variant for ${scenario.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: scenario.viewport, height: 900 }, deviceScaleFactor: scenario.dpr })
    try {
      const page = await context.newPage()
      await page.route('https://images.test/**', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="green"/></svg>',
      }))
      const image = await page.evaluate(async moduleURL => {
        const { responsiveMedia } = await import(moduleURL) as typeof import('../../src/utilities/responsiveMedia')
        return responsiveMedia({ url: 'https://images.test/2400.webp', width: 2400, sizes: {
          thumbnail: { url: 'https://images.test/300.webp', width: 300 },
          card: { url: 'https://images.test/600.webp', width: 600 },
          hero: { url: 'https://images.test/1600.webp', width: 1600 },
        } })
      }, moduleURL)
      await page.setContent(`<img alt="Product" srcset="${image.srcSet}" sizes="${scenario.sizes}" src="${image.src}" style="width:${scenario.sizes}">`)
      await expect.poll(() => page.locator('img').evaluate(image => (image as HTMLImageElement).currentSrc)).toBe(`https://images.test/${scenario.expected}.webp`)
    } finally {
      await context.close()
    }
  })
}
