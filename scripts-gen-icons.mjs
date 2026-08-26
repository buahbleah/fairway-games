/**
 * Rasterises every icon the app ships, from one source of truth.
 *
 *   node scripts-gen-icons.mjs
 *
 * `public/icons/icon.svg` is the only hand-drawn file. It is split on its
 * section comments into four pieces — field, crest, monogram, wordmark — which
 * are recombined here into the shapes each platform actually wants:
 *
 *   full     rounded square, everything            favicon, apple-touch, PWA
 *   play     square corners, everything            Play Store listing (Google
 *                                                  applies its own corners)
 *   maskable full-bleed field + crest, no words    PWA maskable, Android legacy
 *   bg / fg  field and crest as separate layers    Android adaptive icon
 *
 * The wordmark is dropped below the store sizes on purpose: at 48px "FAIRWAY
 * GAMES" is four grey smudges, and a launcher icon has one job — be recognised
 * across the screen. The crest carries the brand there.
 */
import sharp from 'sharp'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const SRC = readFileSync('public/icons/icon.svg', 'utf8')

/** Pull one commented section out of the source drawing. */
function section(name, next) {
  const from = SRC.indexOf(` ${name} -->`)
  if (from < 0) throw new Error(`icon.svg is missing the "${name}" section`)
  const start = SRC.indexOf('>', from) + 1
  if (!next) return SRC.slice(start, SRC.lastIndexOf('</svg>')).trim()
  const marker = SRC.indexOf(` ${next} -->`)
  if (marker < 0) throw new Error(`icon.svg is missing the "${next}" section`)
  return SRC.slice(start, SRC.lastIndexOf('<!--', marker)).trim()
}

const defs = SRC.slice(SRC.indexOf('<defs>'), SRC.indexOf('</defs>') + 7)
const field = section('field', 'crest')
const crest = section('crest', 'monogram')
const monogram = section('monogram', 'wordmark')
const wordmark = section('wordmark')

/** The crest is drawn at centre 256,190 with an outer radius of 130. Move it. */
const placeCrest = (cx, cy, r) =>
  `<g transform="translate(${cx} ${cy}) scale(${(r / 130).toFixed(4)}) translate(-256 -190)">${crest}</g>`

/** Square corners, so a launcher or store can apply its own mask. */
const bleed = field
  .replace(/ rx="1(14|11)"/g, '')
  // the inner hairline only reads on a rounded tile; at full bleed it would
  // leave a half-clipped white line along every edge
  .replace(/<rect x="3"[^>]*\/>/, '')

const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Fairway Games">\n${defs}\n${body}\n</svg>\n`

const variants = {
  full: wrap([field, crest, monogram, wordmark].join('\n')),
  play: wrap([bleed, crest, monogram, wordmark].join('\n')),
  maskable: wrap([bleed, placeCrest(256, 256, 150)].join('\n')),
  bg: wrap(bleed),
  fg: wrap(placeCrest(256, 256, 152)),
  legacy: wrap([field, placeCrest(256, 256, 168)].join('\n')),
  // artwork only, transparent behind it — for the splash, which paints its own
  // field at whatever aspect ratio the phone happens to be
  logo: wrap([crest, monogram, wordmark].join('\n')),
}

// The two that stay on disk, so the PWA manifest and index.html keep working.
writeFileSync('public/icons/icon-maskable.svg', variants.maskable)

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 900 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

const write = async (svg, size, path) => writeFileSync(path, await png(svg, size))

// ------------------------------------------------------------------ web / PWA
for (const size of [48, 192, 512, 1024]) {
  await write(variants.full, size, `public/icons/icon-${size}.png`)
}
await write(variants.maskable, 512, 'public/icons/icon-maskable-512.png')
// iOS rounds the corners itself and shows it around 120px, so it gets the crest.
await write(variants.maskable, 180, 'public/icons/icon-touch-180.png')

// --------------------------------------------------------------- Play Console
await write(variants.play, 512, 'public/icons/icon-play-512.png')

// -------------------------------------------------------------------- Android
const DENSITIES = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const res = 'android/app/src/main/res'

for (const [density, scale] of Object.entries(DENSITIES)) {
  const adaptive = Math.round(108 * scale) // adaptive icon canvas
  const legacy = Math.round(48 * scale) // pre-Oreo launcher icon
  const dir = `${res}/mipmap-${density}`

  await write(variants.bg, adaptive, `${dir}/ic_launcher_background.png`)
  await write(variants.fg, adaptive, `${dir}/ic_launcher_foreground.png`)
  await write(variants.legacy, legacy, `${dir}/ic_launcher.png`)

  // The round variant is masked here because pre-Oreo launchers do not mask.
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}" fill="#fff"/></svg>`,
  )
  writeFileSync(
    `${dir}/ic_launcher_round.png`,
    await sharp(await png(variants.maskable, legacy))
      .composite([{ input: circle, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  )
}

// --------------------------------------------------------------- splash screen
// Capacitor ships one splash.png per orientation, density and night variant.
// Each is regenerated at whatever size it already is, so the set stays whole
// without hardcoding twenty-six dimensions here.
const splashes = readdirSync(res, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('splash.png'))
  .map((f) => `${res}/${f.replace(/\\/g, '/')}`)

for (const path of splashes) {
  const { width, height } = await sharp(path).metadata()
  const short = Math.min(width, height)
  const logo = await png(variants.logo, Math.round(short * 0.58))
  const backdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="s" x1=".18" y1="0" x2=".82" y2="1">
      <stop offset="0%" stop-color="#2f8f52"/><stop offset="45%" stop-color="#1a6b3c"/>
      <stop offset="100%" stop-color="#0a3320"/></linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#s)"/></svg>`

  writeFileSync(
    path,
    await sharp(Buffer.from(backdrop))
      .composite([{ input: logo, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  )
}

console.log(
  `icons written — web, Play Store, six Android densities, ${splashes.length} splash screens`,
)
