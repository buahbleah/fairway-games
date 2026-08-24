import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'
import './design/screens.css'
import { App } from './App'
import { RouterProvider } from './state/router'
import { StoreProvider } from './state/store'

// Offline is the point: the service worker caches the whole app on first load,
// so the round keeps working in a valley with no signal.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* An app without the service worker still runs; it just is not cached. */
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </StoreProvider>
  </StrictMode>,
)

// Clear the launch screen as soon as there is something to look at.
// A timer rather than requestAnimationFrame on purpose: rAF does not fire while
// a tab is hidden, which would leave the splash covering the app.
window.setTimeout(() => {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.classList.add('is-gone')
  window.setTimeout(() => boot.remove(), 260)
}, 0)
