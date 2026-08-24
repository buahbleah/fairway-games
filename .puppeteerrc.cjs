/**
 * Puppeteer is only used by the local screenshot script. Skipping the Chromium
 * download keeps CI and Vercel installs fast — and neither of them needs it.
 */
module.exports = { skipDownload: true }
