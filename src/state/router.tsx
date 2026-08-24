import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * A hash router in 60 lines. The app ships as a single offline page — pulling in
 * a routing library for six screens would cost more than it gives.
 */

export interface Route {
  path: string
  params: Record<string, string>
}

interface RouterValue {
  route: Route
  go: (path: string, opts?: { replace?: boolean }) => void
  back: () => void
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

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  const [depth, setDepth] = useState(0)

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((path: string, opts?: { replace?: boolean }) => {
    const target = path.startsWith('#') ? path : `#${path}`
    if (opts?.replace) {
      window.location.replace(target)
      setRoute(parse(target))
    } else {
      setDepth((d) => d + 1)
      window.location.hash = target
    }
    window.scrollTo({ top: 0 })
  }, [])

  const back = useCallback(() => {
    if (depth > 0) {
      setDepth((d) => d - 1)
      window.history.back()
    } else {
      window.location.hash = '#/'
    }
  }, [depth])

  const value = useMemo(() => ({ route, go, back, canGoBack: depth > 0 }), [route, go, back, depth])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
