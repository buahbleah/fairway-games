/** Rasterises the app icon set from the two source SVGs. Run: node scripts-gen-icons.mjs */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const main = readFileSync('public/icons/icon.svg')
const maskable = readFileSync('public/icons/icon-maskable.svg')

for (const size of [48, 192, 512, 1024]) {
  await sharp(main, { density: 400 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
await sharp(maskable, { density: 400 }).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
console.log('icons written')
