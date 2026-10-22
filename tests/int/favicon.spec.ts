// @vitest-environment node
import fs from 'node:fs/promises'
import { expect, it } from 'vitest'
import sharp from 'sharp'

const root = new URL('../../', import.meta.url)
it('uses the updated site logo for the square transparent tab icon', async () => {
  const actual = await fs.readFile(new URL('public/favicon.png', root))
  const expected = await sharp(await fs.readFile(new URL('public/logo.png', root)))
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  expect(actual.equals(expected)).toBe(true)
  expect(await sharp(actual).metadata()).toMatchObject({ width: 64, height: 64, hasAlpha: true })
})
it('provides matching valid multi-size ICO files for Next and legacy browser requests', async () => {
  const icon = await fs.readFile(new URL('public/favicon.ico', root))
  const routeIcon = await fs.readFile(new URL('src/app/(app)/favicon.ico', root))
  expect(icon.equals(routeIcon)).toBe(true)
  expect(icon.readUInt16LE(2)).toBe(1)
  expect(icon.readUInt16LE(4)).toBe(3)
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16
    const length = icon.readUInt32LE(entry + 8)
    const offset = icon.readUInt32LE(entry + 12)
    expect(await sharp(icon.subarray(offset, offset + length)).metadata()).toMatchObject({ width: size, height: size })
  }
})
