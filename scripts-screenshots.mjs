/**
 * Captures the key screens for design review.
 *   node scripts-screenshots.mjs [baseUrl]
 * Writes PNGs into screenshots/.
 */
import puppeteer from 'puppeteer'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const ROSTER = {
  version: 1,
  rounds: [],
  roster: [
    { id: 'p1', name: 'Marc', handicapIndex: 11.4, colorIndex: 0 },
    { id: 'p2', name: 'Phil', handicapIndex: 18.2, colorIndex: 1 },
    { id: 'p3', name: 'Mike', handicapIndex: 6.1, colorIndex: 2 },
    { id: 'p4', name: 'John', handicapIndex: 24, colorIndex: 3 },
  ],
  presets: [],
  prefs: { theme: 'light', contrast: 'normal', haptics: true, currency: 'CHF' },
  undo: {},
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

async function seed(theme = 'light', rounds = []) {
  await page.evaluate(
    (state) => {
      localStorage.setItem('fairway.v1', JSON.stringify(state))
    },
    { ...ROSTER, rounds, prefs: { ...ROSTER.prefs, theme } },
  )
}

async function shot(name, full = false) {
  await sleep(450)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('  ✓', name)
}

async function goto(hash) {
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
  await sleep(350)
}

/** Clicks the first button whose trimmed text matches. */
async function click(text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim().toLowerCase() === t.toLowerCase(),
    )
    if (!el) return false
    el.click()
    return true
  }, text)
  await sleep(260)
  return ok
}

/** Walks setup for a game and returns on the first hole. */
async function startRound(game) {
  await goto(`/setup?game=${game}`)
  for (let i = 0; i < 3; i++) await click('Continue')
  await click('Start Round')
  await sleep(350)
}

async function fillScores(bumps = []) {
  await page.evaluate(() => {
    document.querySelectorAll('.scorerow .stepper__value').forEach((b) => b.click())
  })
  await sleep(300)
  for (const [row, delta] of bumps) {
    for (let i = 0; i < Math.abs(delta); i++) {
      await page.evaluate(
        (r, up) => {
          const rows = document.querySelectorAll('.scorerow')
          rows[r].querySelectorAll('.stepper__btn')[up ? 1 : 0].click()
        },
        row,
        delta > 0,
      )
      await sleep(110)
    }
  }
}

await page.goto(BASE, { waitUntil: 'networkidle0' })
await seed()
await page.reload({ waitUntil: 'networkidle0' })
await sleep(500)

console.log('capturing…')

// 1 home (empty)
await goto('/')
await shot('01-home')

// 2 game selection
await goto('/games')
await shot('02-game-select', true)

// 3 rules screen
await goto('/game/vegas')
await shot('03-rules-vegas', true)

// 4 setup
await goto('/setup?game=wolf')
await shot('04-setup-players')

// 5 wolf hole screen — the pick stage
await startRound('wolf')
await shot('05-wolf-pick')

// 6 wolf result
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.wolfpick')].find((x) => x.textContent.includes('Phil'))
  b?.click()
})
await sleep(300)
await fillScores([[1, 2], [2, 1], [3, 1]])
await shot('06-wolf-scores')
await click('Confirm hole')
await shot('07-wolf-result')

// 8 skins
await startRound('skins')
await fillScores()
await click('Confirm hole')
await click('Hole 2')
await shot('08-skins')

// 9 nassau
await startRound('nassau')
await fillScores([[0, -1]])
await click('Confirm hole')
await shot('09-nassau')

// 10 vegas
await startRound('vegas')
await fillScores([[1, 1], [2, -1], [3, 2]])
await shot('10-vegas')

// 11 dots
await startRound('dots')
await fillScores([[0, -1]])
await click('Anything extra?')
await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.dotchip')]
  chips.find((c) => c.textContent.includes('Chip-In'))?.click()
  chips.filter((c) => c.textContent.includes('Snake'))[2]?.click()
})
await shot('11-dots')

// 12 team match
await startRound('team_match_play')
await fillScores([[1, 2], [2, 1], [3, 1]])
await click('Confirm hole')
await shot('12-team-match')

// 13 leaderboard sheet
await page.evaluate(() => {
  document.querySelector('button[aria-label="Leaderboard"]')?.click()
})
await shot('13-leaderboard')

// 14 final result
const roundId = await page.evaluate(() => JSON.parse(localStorage.getItem('fairway.v1')).rounds[0].id)
await goto(`/results?round=${roundId}`)
await shot('14-result', true)

// 15 share card
await click('Share result')
await shot('15-share-card')

// 16 settings
await goto('/settings')
await shot('16-settings', true)

// 17-19 dark mode
await seed('dark')
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
await goto('/')
await shot('17-home-dark')
await goto('/games')
await shot('18-games-dark', true)
await startRound('vegas')
await fillScores([[1, 1], [2, -1], [3, 2]])
await shot('19-vegas-dark')

await browser.close()
console.log('done →', OUT)
