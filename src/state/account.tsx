import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError, type Account, type InvitesPayload } from '../net/api'

/**
 * Who is signed in, if anyone.
 *
 * Signing in is entirely optional: the app plays a full round with no account
 * and no connection. An account only adds friends, leagues and live scoring.
 * The cached account is kept in localStorage so the UI does not flash "signed
 * out" every time the app opens on a course with no signal.
 */

const CACHE_KEY = 'fairway.account.v1'

interface AccountValue {
  account: Account | null
  /** True until the first /me call settles. */
  loading: boolean
  online: boolean
  invites: InvitesPayload | null
  register: (input: {
    email: string
    name: string
    password: string
    handicapIndex?: number | null
  }) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (input: { name?: string; handicapIndex?: number | null; colorIndex?: number }) => Promise<void>
  refreshInvites: () => Promise<void>
}

const AccountContext = createContext<AccountValue | null>(null)

function readCache(): Account | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

function writeCache(account: Account | null) {
  try {
    if (account) localStorage.setItem(CACHE_KEY, JSON.stringify(account))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* storage full or blocked — not fatal */
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(() => readCache())
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [invites, setInvites] = useState<InvitesPayload | null>(null)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const apply = useCallback((next: Account | null) => {
    setAccount(next)
    writeCache(next)
  }, [])

  const refreshInvites = useCallback(async () => {
    try {
      setInvites(await api.invites())
    } catch {
      /* offline, or signed out — the badge just does not update */
    }
  }, [])

  // Confirm the session with the server once on load.
  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then(({ user }) => {
        if (cancelled) return
        apply(user)
        if (user) void refreshInvites()
      })
      .catch((err) => {
        // A network failure must not sign anyone out — keep the cached account.
        if (err instanceof ApiError && !err.offline && err.status === 401) apply(null)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [apply, refreshInvites])

  // Poll for invitations while signed in, gently.
  useEffect(() => {
    if (!account) return
    const timer = window.setInterval(() => void refreshInvites(), 60_000)
    return () => window.clearInterval(timer)
  }, [account, refreshInvites])

  const value = useMemo<AccountValue>(
    () => ({
      account,
      loading,
      online,
      invites,
      register: async (input) => {
        const { user } = await api.register(input)
        apply(user)
        void refreshInvites()
      },
      login: async (email, password) => {
        const { user } = await api.login({ email, password })
        apply(user)
        void refreshInvites()
      },
      logout: async () => {
        try {
          await api.logout()
        } finally {
          apply(null)
          setInvites(null)
        }
      },
      updateProfile: async (input) => {
        const { user } = await api.updateProfile(input)
        apply(user)
      },
      refreshInvites,
    }),
    [account, loading, online, invites, apply, refreshInvites],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider')
  return ctx
}
