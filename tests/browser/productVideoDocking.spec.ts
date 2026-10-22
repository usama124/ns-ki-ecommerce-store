import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// Real media + IntersectionObserver, without contacting the application DB or R2.
let javascript = ''
let css = ''
let media: Buffer
test.beforeAll(async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nski-reel-'))
  const file = join(directory, 'reel.webm')
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=90x160:r=15', '-t', '6', '-c:v', 'libvpx', '-an', file])
  media = readFileSync(file)
  const sourceRoot = fileURLToPath(new URL('../../src', import.meta.url))
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { FloatingProductVideo } from '@/components/product/FloatingProductVideo';
    import ${JSON.stringify(`${sourceRoot}/app/(app)/globals.css`)};
    createRoot(document.getElementById('root')).render(React.createElement(FloatingProductVideo, {
      src: 'https://reel.test/video.webm', title: 'Winter suit'
    }));
  `
  const result = await build({
    configFile: false, logLevel: 'silent', resolve: { alias: { '@': sourceRoot } },
    esbuild: { jsx: 'automatic' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'reel-fixture', resolveId: id => id === 'virtual:reel' ? '\0reel.js' : undefined, load: id => id === '\0reel.js' ? entry : undefined }],
    build: { write: false, minify: false, cssCodeSplit: false, rollupOptions: { input: 'virtual:reel', output: { format: 'iife', name: 'ReelFixture' } } },
  })
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
  for (const output of outputs) {
    if (output.type === 'chunk') javascript += output.code
    else if (output.fileName.endsWith('.css')) css += String(output.source)
  }
})

for (const width of [390, 1440]) {
  test(`same video keeps looping when scrolling between floating and inline at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('https://reel.test/video.webm', route => route.fulfill({ contentType: 'video/webm', body: media, headers: { 'access-control-allow-origin': '*' } }))
    await page.setContent('<html><body><div id="root"></div><div style="height:1200px">Product details</div><section data-product-reel-inline><div data-product-reel-slot style="position:relative;width:250px;aspect-ratio:9/16;margin:auto"></div></section><div style="height:1200px"></div></body></html>')
    await page.addStyleTag({ content: css })
    await page.addScriptTag({ content: javascript })
    const video = page.locator('aside video')
    await expect(page.locator('[data-player-mode="floating"]')).toBeVisible()
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1)
    await video.evaluate(element => { element.setAttribute('data-original-video', 'true'); (element as HTMLVideoElement).currentTime = 2 })
    await page.locator('[data-product-reel-slot]').scrollIntoViewIfNeeded()
    await expect(page.locator('[data-product-reel-slot] [data-player-mode="inline"]')).toBeVisible()
    await expect(page.locator('video')).toHaveCount(1)
    await expect(video).toHaveAttribute('data-original-video', 'true')
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(2.1)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('[data-player-mode="floating"]')).toBeVisible()
    await expect(video).toHaveAttribute('data-original-video', 'true')
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false)
    // Seek near the end and verify actual looping, not only the loop attribute.
    await video.evaluate(element => { (element as HTMLVideoElement).currentTime = 5.8 })
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime), { timeout: 5000 }).toBeLessThan(2)
    await expect(page.locator('video')).toHaveCount(1)
  })
}
