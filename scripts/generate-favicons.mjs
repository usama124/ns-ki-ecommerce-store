import fs from 'node:fs/promises'
import sharp from 'sharp'

// Generate browser assets from the exact site logo, without cropping or redrawing it.
const root = new URL('../', import.meta.url)
const logo = await fs.readFile(new URL('public/logo.png', root))
const png = size => sharp(logo).resize(size, size, {
  fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
}).png().toBuffer()

await fs.writeFile(new URL('public/favicon.png', root), await png(64))

// ICO supports PNG-compressed entries. Include common browser/OS icon sizes.
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map(png))
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16
  header[entry] = sizes[index]
  header[entry + 1] = sizes[index]
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(images[index].length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += images[index].length
}
const ico = Buffer.concat([header, ...images])
await Promise.all(['public/favicon.ico', 'src/app/(app)/favicon.ico'].map(file => fs.writeFile(new URL(file, root), ico)))
console.log('Generated tab icons from public/logo.png. Apple touch icon unchanged.')
