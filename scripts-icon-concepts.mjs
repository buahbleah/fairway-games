/**
 * App icon concepts, rendered large and at 48px — the size where most icons
 * fall apart and the only one that settles an argument.
 *   node scripts-icon-concepts.mjs
 * Writes into icon-concepts/.
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'icon-concepts'
mkdirSync(OUT, { recursive: true })

const DEEP = '#071410'
const MID = '#1b4a37'
const SAND = '#c79a4b'
const SAND_HI = '#e7cd9c'
const CREAM = '#ffffff'

const defsCommon = `
  <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0%" stop-color="${MID}"/>
    <stop offset="55%" stop-color="#0e2b21"/>
    <stop offset="100%" stop-color="${DEEP}"/>
  </linearGradient>
  <radialGradient id="ball" cx="0.36" cy="0.3" r="0.78">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="70%" stop-color="#f2ede2"/>
    <stop offset="100%" stop-color="#d3cbba"/>
  </radialGradient>`

const wrap = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${defsCommon}${defs ?? ''}</defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  ${body}
</svg>`

/** Dimples laid out as a dice six. Small enough to still read as a ball. */
const diceSix = (cx, cy, r, dot) => {
  const dx = r * 0.42
  const dy = r * 0.44
  return [
    [cx - dx, cy - dy],
    [cx + dx, cy - dy],
    [cx - dx, cy],
    [cx + dx, cy],
    [cx - dx, cy + dy],
    [cx + dx, cy + dy],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${dot}" fill="${DEEP}" fill-opacity=".82"/>`)
    .join('')
}

const concepts = {
  /**
   * A ball whose dimples are a dice six. Golf and betting in one mark, which is
   * what the app actually is — six games you play for something.
   */
  'a-dice-ball': wrap(
    '',
    `
    <circle cx="256" cy="248" r="158" fill="url(#ball)"/>
    ${diceSix(256, 248, 158, 20)}
    <path d="M60 428c78-34 142-40 206-18s124 30 190-14" fill="none"
          stroke="${SAND}" stroke-opacity=".6" stroke-width="14" stroke-linecap="round"/>`,
  ),

  /**
   * The same idea with the flagstick behind it, so the golf reading arrives
   * before the dice reading does.
   */
  'b-dice-and-flag': wrap(
    '',
    `
    <path d="M368 424V116" stroke="${CREAM}" stroke-width="20" stroke-linecap="round" stroke-opacity=".95"/>
    <path d="M368 126l112 44-112 46z" fill="${SAND}"/>
    <circle cx="222" cy="286" r="140" fill="url(#ball)"/>
    ${diceSix(222, 286, 140, 18)}`,
  ),

  /**
   * The flagstick as a bold diagonal — the strongest silhouette of the set, and
   * the one that still has shape at 48px.
   */
  'c-diagonal-flag': wrap(
    '',
    `
    <path d="M132 438L336 96" stroke="${CREAM}" stroke-width="34" stroke-linecap="round"/>
    <path d="M340 104l140 58-160 62z" fill="${SAND}"/>
    <circle cx="146" cy="392" r="78" fill="url(#ball)"/>
    ${diceSix(146, 392, 78, 11)}`,
  ),

  /**
   * Everything stripped away but the flag, at maximum weight. Nothing here can
   * fail to read, at any size.
   */
  'd-flag-only': wrap(
    '',
    `
    <path d="M180 448V92" stroke="${CREAM}" stroke-width="38" stroke-linecap="round"/>
    <path d="M186 104l190 68-190 72z" fill="${SAND}"/>
    <ellipse cx="180" cy="446" rx="96" ry="24" fill="${SAND}" fill-opacity=".22"/>`,
  ),

  /**
   * The hole from above with the ball on the lip, rings thickened so they
   * survive being shrunk.
   */
  'e-cup-above': wrap(
    '',
    `
    <circle cx="248" cy="268" r="176" fill="none" stroke="${SAND}" stroke-opacity=".3" stroke-width="22"/>
    <circle cx="248" cy="268" r="116" fill="${DEEP}"/>
    <circle cx="248" cy="268" r="116" fill="none" stroke="${SAND_HI}" stroke-width="24"/>
    <circle cx="344" cy="150" r="74" fill="url(#ball)"/>
    ${diceSix(344, 150, 74, 10)}`,
  ),
}

/* ------------------------------------------------------------- rendering */

const names = Object.keys(concepts)

for (const [name, svg] of Object.entries(concepts)) {
  const buf = Buffer.from(svg)
  await sharp(buf, { density: 500 }).resize(512, 512).png().toFile(`${OUT}/${name}-512.png`)
  await sharp(buf, { density: 500 }).resize(48, 48).png().toFile(`${OUT}/${name}-48.png`)
  writeFileSync(`${OUT}/${name}.svg`, svg)
  console.log('  ✓', name)
}

const CELL = 300
const sheetW = CELL * names.length
const sheetH = CELL + 120

const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
  <rect width="${sheetW}" height="${sheetH}" fill="#f8f4ea"/>
  ${names
    .map(
      (n, i) =>
        `<text x="${i * CELL + CELL / 2}" y="${CELL + 46}" text-anchor="middle"
           font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#14170f">${n[0].toUpperCase()}</text>
         <text x="${i * CELL + CELL / 2}" y="${CELL + 78}" text-anchor="middle"
           font-family="Arial,sans-serif" font-size="19" fill="#5c6259">${n.slice(2).replace(/-/g, ' ')}</text>`,
    )
    .join('')}
</svg>`

const layers = []
for (let i = 0; i < names.length; i++) {
  const big = await sharp(Buffer.from(concepts[names[i]]), { density: 500 })
    .resize(236, 236)
    .png()
    .toBuffer()
  const small = await sharp(Buffer.from(concepts[names[i]]), { density: 500 })
    .resize(48, 48)
    .png()
    .toBuffer()
  layers.push({ input: big, top: 22, left: i * CELL + 12 })
  layers.push({ input: small, top: 210, left: i * CELL + 240 })
}

await sharp(Buffer.from(label)).composite(layers).png().toFile(`${OUT}/_all-concepts.png`)
console.log('\n  ✓ _all-concepts.png  (large + 48px of each)')
