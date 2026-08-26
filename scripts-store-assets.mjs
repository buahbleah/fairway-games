/**
 * Builds the Play Store artwork from the app's own design language.
 *   node scripts-store-assets.mjs
 * Writes into store/.
 *
 * Play rejects screenshots taller than 2:1, and the captures in screenshots/
 * are 780x1688 (2.16:1). Each one is placed on a 1080x1920 board here, which
 * fixes the ratio and gives the listing a caption at the same time.
 */
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'

const OUT = 'store'
mkdirSync(OUT, { recursive: true })

const GREEN_DEEP = '#071410'
const GREEN_MID = '#17402f'
const SAND = '#c79a4b'
const CREAM = '#f4f1e8'

/** The contour geometry used behind hero areas throughout the app. */
const contours = (width, height, opacity = 0.18) => `
  <g fill="none" stroke="${SAND}" stroke-opacity="${opacity}" stroke-width="${Math.round(width / 180)}">
    <path d="M${-width * 0.05} ${height * 0.82}
             C ${width * 0.25} ${height * 0.66}, ${width * 0.5} ${height * 0.74}, ${width * 0.72} ${height * 0.62}
             S ${width * 0.95} ${height * 0.5}, ${width * 1.05} ${height * 0.46}"/>
    <path d="M${-width * 0.05} ${height * 0.92}
             C ${width * 0.27} ${height * 0.76}, ${width * 0.52} ${height * 0.84}, ${width * 0.74} ${height * 0.72}
             S ${width * 0.97} ${height * 0.6}, ${width * 1.05} ${height * 0.56}"/>
    <path d="M${-width * 0.05} ${height * 0.72}
             C ${width * 0.23} ${height * 0.56}, ${width * 0.48} ${height * 0.64}, ${width * 0.7} ${height * 0.52}
             S ${width * 0.93} ${height * 0.4}, ${width * 1.05} ${height * 0.36}"/>
  </g>`

/**
 * The crest, lifted straight out of the app icon so the listing and the
 * launcher cannot drift apart. It is drawn there at centre 256,190 with an
 * outer radius of 130; this moves and scales it.
 */
const ICON = readFileSync('public/icons/icon.svg', 'utf8')
const iconDefs = ICON.slice(ICON.indexOf('<defs>') + 6, ICON.indexOf('</defs>'))
const iconCrest = ICON.slice(
  ICON.indexOf('>', ICON.indexOf(' crest -->')) + 1,
  ICON.lastIndexOf('<!--', ICON.indexOf(' monogram -->')),
)
const mark = (cx, cy, r) =>
  `<g transform="translate(${cx} ${cy}) scale(${(r / 130).toFixed(4)}) translate(-256 -190)">${iconCrest}</g>`

const FONT = "'DejaVu Sans','Bahnschrift','Segoe UI',Arial,sans-serif"

/* ------------------------------------------------------- feature graphic */

const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${GREEN_MID}"/>
      <stop offset="55%" stop-color="#0e2b21"/>
      <stop offset="100%" stop-color="${GREEN_DEEP}"/>
    </linearGradient>
    ${iconDefs}
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  ${contours(1024, 500, 0.16)}
  ${mark(770, 250, 168)}
  <text x="72" y="196" font-family="${FONT}" font-size="34" font-weight="700"
        letter-spacing="10" fill="${SAND}">FAIRWAY GAMES</text>
  <text x="72" y="286" font-family="${FONT}" font-size="66" font-weight="700"
        letter-spacing="-1" fill="${CREAM}">Six golf games.</text>
  <text x="72" y="356" font-family="${FONT}" font-size="66" font-weight="700"
        letter-spacing="-1" fill="${CREAM}">One tap each.</text>
  <text x="72" y="418" font-family="${FONT}" font-size="30" fill="${CREAM}" fill-opacity="0.72">
    Wolf · Skins · Nassau · Vegas · Dots · Team Match
  </text>
</svg>`

await sharp(Buffer.from(featureSvg)).png().toFile(`${OUT}/feature-graphic-1024x500.png`)
console.log('  ✓ feature-graphic-1024x500.png')

/* ----------------------------------------------------- store screenshots */

const SHOTS = [
  ['01-home', 'Six games, ready to play'],
  ['05-wolf-pick', 'One decision at a time'],
  ['10-vegas', 'Vegas, built in front of you'],
  ['23-handicaps', 'Even it up with handicaps'],
  ['11-dots', 'Tap the good bits'],
  ['12-team-match', 'Match play, hole by hole'],
  ['17-home-dark', 'Made for early tee times'],
]

const W = 1080
const H = 1920
const PHONE_TOP = 300

for (const [file, caption] of SHOTS) {
  const phone = await sharp(`screenshots/${file}.png`)
    .resize({ width: 760, withoutEnlargement: false })
    .toBuffer()
  const meta = await sharp(phone).metadata()

  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stop-color="${GREEN_MID}"/>
        <stop offset="60%" stop-color="#0e2b21"/>
        <stop offset="100%" stop-color="${GREEN_DEEP}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${contours(W, H, 0.12)}
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="${FONT}" font-size="26"
          font-weight="700" letter-spacing="8" fill="${SAND}">FAIRWAY GAMES</text>
    <text x="${W / 2}" y="232" text-anchor="middle" font-family="${FONT}" font-size="52"
          font-weight="700" fill="${CREAM}">${caption}</text>
  </svg>`

  await sharp(Buffer.from(board))
    .composite([
      {
        input: phone,
        top: PHONE_TOP,
        left: Math.round((W - (meta.width ?? 760)) / 2),
      },
    ])
    .png()
    .toFile(`${OUT}/screenshot-${file}.png`)
  console.log('  ✓ screenshot-' + file + '.png')
}

console.log('\nAll assets written to ' + OUT + '/')
