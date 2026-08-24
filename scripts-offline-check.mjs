/** Verifies the built app really works with the network switched off. */
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 2500)) // let the service worker precache

const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return !!reg && !!(reg.active || reg.installing || reg.waiting)
})
console.log('service worker registered:', swReady)

await page.setOfflineMode(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 1200))

const text = await page.evaluate(() => document.body.innerText)
const works = text.includes('Wolf') && text.includes('Skins') && text.includes('START ROUND')
console.log('offline reload rendered the app:', works)

// Prove a round can still be played with no network at all.
await page.evaluate(() => {
  localStorage.setItem(
    'fairway.v1',
    JSON.stringify({
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
    }),
  )
  window.location.hash = '#/setup?game=skins'
})
await page.reload({ waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 1200))

const click = async (label) => {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim().toLowerCase() === t.toLowerCase(),
    )
    el?.click()
  }, label)
  await new Promise((r) => setTimeout(r, 260))
}
for (let i = 0; i < 3; i++) await click('Continue')
await click('Start Round')
await new Promise((r) => setTimeout(r, 400))
await page.evaluate(() => {
  document.querySelectorAll('.scorerow .stepper__value').forEach((b) => b.click())
})
await new Promise((r) => setTimeout(r, 400))
await page.evaluate(() => {
  document.querySelectorAll('.scorerow')[0].querySelectorAll('.stepper__btn')[0].click()
})
await new Promise((r) => setTimeout(r, 300))
await click('Confirm hole')
await new Promise((r) => setTimeout(r, 400))
const after = await page.evaluate(() => document.body.innerText)
console.log('offline hole scored:', after.includes('wins 1 skin'))

// And that it survives a restart while still offline.
await page.reload({ waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 1200))
const resumed = await page.evaluate(() => document.body.innerText)
console.log('offline round resumed after reload:', resumed.includes('Skins'))

await browser.close()
