import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parentPath } from './navigation'

/**
 * A small hash router. The app ships as a single offline page, so a routing
 * library would cost more than it gives.
 *
 * Two things it has to get right, both learned the hard way:
 *
 * 1. How deep we are is kept in `history.state`, not in React state. React
 *    state resets on every reload — and on Android the packaged app is reloaded
 *    whenever the system reclaims it — which left Back jumping to the home
 *    screen from halfway down a flow.
 *
 * 2. When there is no history to go back to, Back goes to the screen's logical
 *    parent rather than the home screen. A round opened from a league belongs
 *    to that league, and that is where Back should land.
 */

export interface Route {
  path: string
  params: Record<string, string>
}

interface RouterValue {
  route: Route
  go: (path: string, opts?: { replace?: boolean }) => void
  /** Back one step, falling back to `fallback` (or the logical parent). */
  back: (fallback?: string) => void
  /**
   * Go to a screen's logical parent regardless of history. Used where history
   * would be misleading: a round is reached by replacing the setup screen, so
   * stepping back through history lands on the game picker rather than on the
   * league the round was started from.
   */
  up: (path: string) => void
  canGoBack: boolean
}

const RouterContext = createContext<RouterValue | null>(null)

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, query] = raw.split('?')
  const params: Record<string, string> = {}
  if (query) {
    for (const [k, v] of new URLSearchParams(query)) params[k] = v
  }
  return { path: path || '/', params }
}

function depthOf(): number {
  const state = window.history.state as { fwDepth?: number } | null
  return typeof state?.fwDepth === 'number' ? state.fwDepth : 0
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  const [depth, setDepth] = useState(() => depthOf())

  useEffect(() => {
    const sync = () => {
      setRoute(parse(window.location.hash))
      setDepth(depthOf())
    }
    // popstate covers Back and Forward, including the Android hardware button.
    // hashchange covers anything that changes the hash from outside the router.
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const go = useCallback((path: string, opts?: { replace?: boolean }) => {
    const target = path.startsWith('#') ? path : `#${path}`
    const current = depthOf()
    // pushState/replaceState rather than assigning location.hash: it keeps the
    // depth marker and the history entry in step, which assigning never did.
    if (opts?.replace) {
      window.history.replaceState({ fwDepth: current }, '', target)
      setDepth(current)
    } else {
      window.history.pushState({ fwDepth: current + 1 }, '', target)
      setDepth(current + 1)
    }
    setRoute(parse(target))
    window.scrollTo({ top: 0 })
  }, [])

  const back = useCallback(
    (fallback?: string) => {
      if (depthOf() > 0) {
        window.history.back()
        return
      }
      const target = fallback ?? parentPath(parse(window.location.hash))
      window.history.replaceState({ fwDepth: 0 }, '', `#${target}`)
      setRoute(parse(target))
      setDepth(0)
      window.scrollTo({ top: 0 })
    },
    [],
  )

  const up = useCallback((path: string) => {
    const next = Math.max(0, depthOf() - 1)
    window.history.replaceState({ fwDepth: next }, '', `#${path}`)
    setRoute(parse(path))
    setDepth(next)
    window.scrollTo({ top: 0 })
  }, [])

  // Make sure the very first entry carries a depth, so a deep link behaves.
  useEffect(() => {
    if (window.history.state?.fwDepth === undefined) {
      window.history.replaceState({ fwDepth: 0 }, '', window.location.hash || '#/')
    }
  }, [])

  const value = useMemo(
    () => ({ route, go, back, up, canGoBack: depth > 0 }),
    [route, go, back, up, depth],
  )
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
