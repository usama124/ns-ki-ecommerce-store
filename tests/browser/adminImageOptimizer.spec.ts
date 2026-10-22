import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import ts from 'typescript'
import sharp from 'sharp'

const source = fs.readFileSync(new URL('../../src/utilities/adminImageOptimizer.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const moduleURL = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`

test('tight portrait crop removes the blank area and keeps exact 2:3 pixels', async ({ page }) => {
  const result = await page.evaluate(async moduleURL => {
    const optimizer = await import(moduleURL) as typeof import('../../src/utilities/adminImageOptimizer')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1200
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 1200, 1200)
    ctx.fillStyle = '#008000'
    ctx.fillRect(400, 300, 400, 600)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    const image = await optimizer.loadEditableImage(new File([blob], 'product.png', { type: 'image/png' }))
    const crop = optimizer.scaleImageCrop(optimizer.fitAspectCrop(1200, 1200, 2 / 3), 0.5)
    const output = await optimizer.encodeImage(image, 'product.png', { crop, maxWidth: 1600, maxHeight: 2400, quality: 85, aspectRatio: 'portrait' })
    const decoded = await optimizer.loadEditableImage(output.file)
    canvas.width = output.width
    canvas.height = output.height
    ctx.drawImage(decoded, 0, 0)
    return { width: output.width, height: output.height, corner: [...ctx.getImageData(5, 5, 1, 1).data] }
  }, moduleURL)
  expect(result).toMatchObject({ width: 400, height: 600 })
  expect(result.corner[0]).toBeLessThan(10)
  expect(result.corner[1]).toBeGreaterThan(110)
  expect(result.corner[1]).toBeLessThan(145)
  expect(result.corner[3]).toBe(255)
})

test('real browser WebP encoding: crop, dimensions, transparency and measured bytes', async ({ page }) => {
  const result = await page.evaluate(async moduleURL => {
    const optimizer = await import(moduleURL) as typeof import('../../src/utilities/adminImageOptimizer')
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 900
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 300, 900)
    // Transparent right half, retained in crop.
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    const file = new File([blob], 'transparent.png', { type: 'image/png' })
    const image = await optimizer.loadEditableImage(file)
    const output = await optimizer.encodeImage(image, file.name, {
      crop: { x: 25, y: 0, width: 75, height: 100 }, maxWidth: 300, maxHeight: 300, quality: 85,
    })
    const decoded = await optimizer.loadEditableImage(output.file)
    const check = document.createElement('canvas')
    check.width = output.width
    check.height = output.height
    const checkContext = check.getContext('2d')!
    checkContext.drawImage(decoded, 0, 0)
    return {
      type: output.file.type, name: output.file.name, bytes: output.file.size,
      width: decoded.naturalWidth, height: decoded.naturalHeight,
      red: [...checkContext.getImageData(5, 5, 1, 1).data],
      clear: [...checkContext.getImageData(output.width - 5, 5, 1, 1).data],
    }
  }, moduleURL)
  expect(result).toMatchObject({ type: 'image/webp', name: 'transparent.webp', width: 150, height: 300 })
  expect(result.bytes).toBeGreaterThan(0)
  expect(result.red[0]).toBeGreaterThan(245)
  expect(result.red[3]).toBe(255)
  expect(result.clear[3]).toBe(0)
})

test('quality changes actual encoded size and small images are never enlarged', async ({ page }) => {
  const result = await page.evaluate(async moduleURL => {
    const optimizer = await import(moduleURL) as typeof import('../../src/utilities/adminImageOptimizer')
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    const pixels = ctx.createImageData(300, 200)
    let seed = 17
    for (let i = 0; i < pixels.data.length; i++) {
      seed = (seed * 16807) % 2147483647
      pixels.data[i] = i % 4 === 3 ? 255 : seed % 256
    }
    ctx.putImageData(pixels, 0, 0)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    const image = await optimizer.loadEditableImage(new File([blob], 'noise.png', { type: 'image/png' }))
    const settings = { crop: optimizer.FULL_CROP, maxWidth: 1600, maxHeight: 2400, quality: 95 }
    const high = await optimizer.encodeImage(image, 'noise.png', settings)
    const low = await optimizer.encodeImage(image, 'noise.png', { ...settings, quality: 40 })
    return { original: blob.size, high: high.file.size, low: low.file.size, width: low.width, height: low.height }
  }, moduleURL)
  expect(result).toMatchObject({ width: 300, height: 200 })
  expect(result.low).toBeLessThan(result.high)
  expect(result.high).toBeLessThan(result.original)
})

test('uses browser EXIF orientation when decoding a phone JPEG', async ({ page }) => {
  const jpeg = await sharp({ create: { width: 80, height: 120, channels: 3, background: '#ff0000' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const result = await page.evaluate(async ({ moduleURL, base64 }) => {
    const optimizer = await import(moduleURL) as typeof import('../../src/utilities/adminImageOptimizer')
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    const image = await optimizer.loadEditableImage(new File([bytes], 'phone.jpg', { type: 'image/jpeg' }))
    const result = await optimizer.encodeImage(image, 'phone.jpg', { crop: optimizer.FULL_CROP, maxWidth: 1600, maxHeight: 2400, quality: 85 })
    return { width: result.width, height: result.height }
  }, { moduleURL, base64: jpeg.toString('base64') })
  expect(result).toEqual({ width: 120, height: 80 })
})
