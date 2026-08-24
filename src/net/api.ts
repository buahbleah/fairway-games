/**
 * The one place that talks to the server.
 *
 * Every call is expected to fail sometimes — this app is used on a golf course,
 * where signal comes and goes. Callers get a typed ApiError with `offline` set
 * when the request never left the phone, so the UI can say "saved, will sync"
 * rather than "something went wrong".
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public offline = false,
  ) {
    super(message)
  }
}

/**
 * Where the API lives.
 *
 * On the web the app and the API share an origin, so a relative path is right.
 * Inside the packaged Android/iOS app the pages are served from a localhost
 * scheme, so the API has to be addressed absolutely — and because that makes
 * every request cross-origin, the session travels as a bearer token rather than
 * a cookie. Third-party cookies in an Android WebView are not dependable.
 */
const NATIVE: boolean = (() => {
  try {
    const cap = (globalThis as any).Capacitor
    return !!cap?.isNativePlatform?.()
  } catch {
    return false
  }
})()

const API_ORIGIN =
  (import.meta as any).env?.VITE_API_ORIGIN ?? 'https://fairway-games-phils-projects-a6db7377.vercel.app'

const BASE = NATIVE ? `${API_ORIGIN}/api` : '/api'

const TOKEN_KEY = 'fairway.token.v1'

function readToken(): string | null {
  if (!NATIVE) return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string | null | undefined) {
  if (!NATIVE) return
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage blocked — the session simply will not persist a restart */
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken()
  const headers: Record<string, string> = {}
  if (init.body) headers['Content-Type'] = 'application/json'
  if (NATIVE) {
    headers['X-Fairway-Client'] = 'native'
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: NATIVE ? 'include' : 'same-origin',
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    })
  } catch {
    throw new ApiError(0, 'No connection.', true)
  }

  const text = await res.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new ApiError(res.status, 'The server sent something unexpected.')
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status}).`)
  }
  return data as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })

/* ------------------------------------------------------------------- types */

export interface Account {
  id: string
  email: string
  name: string
  handicapIndex: number | null
  colorIndex: number
}

export interface Friend {
  id: string
  email: string
  name: string
  handicapIndex: number | null
  colorIndex: number
}

export interface FriendsPayload {
  friends: Friend[]
  incoming: { id: string; from: Friend; createdAt: string }[]
  outgoing: { id: string; email: string; hasAccount: boolean; createdAt: string }[]
}

export interface League {
  id: string
  name: string
  description: string | null
  joinCode: string
  role: string
  isOwner: boolean
  memberCount: number
  roundCount: number
  createdAt: string
}

export interface LeagueDetail {
  league: {
    id: string
    name: string
    description: string | null
    joinCode: string
    isOwner: boolean
    createdAt: string
  }
  members: (Friend & { role: string; joinedAt: string })[]
  rounds: RoundSummary[]
}

export interface RoundPlayerDoc {
  id: string
  userId: string | null
  name: string
  handicapIndex: number | null
  colorIndex: number
}

export interface RoundSummary {
  id: string
  gameId: string
  title: string | null
  status: 'active' | 'finished'
  leagueId?: string | null
  leagueName?: string | null
  isHost?: boolean
  currentHole: number
  holesPlayed: number
  version?: number
  createdAt: string
  updatedAt: string
  players: RoundPlayerDoc[]
}

export interface RoundDoc {
  id: string
  leagueId: string | null
  hostId: string
  gameId: string
  title: string | null
  status: 'active' | 'finished'
  settings: Record<string, any>
  course: Record<string, any>
  gameState: Record<string, any>
  currentHole: number
  version: number
  createdAt: string
  updatedAt: string
  players: RoundPlayerDoc[]
  entries: { hole: number; scores: Record<string, number | null>; game: Record<string, any>; complete: boolean }[]
}

export interface InvitesPayload {
  rounds: {
    id: string
    roundId: string
    gameId: string
    title: string | null
    leagueName: string | null
    invitedBy: string
    createdAt: string
  }[]
  friends: { id: string; name: string; email: string; createdAt: string }[]
  total: number
}

/* ------------------------------------------------------------------ surface */

export const api = {
  me: () => get<{ user: Account | null }>('/auth/me'),
  register: async (input: { email: string; name: string; password: string; handicapIndex?: number | null }) => {
    const out = await post<{ user: Account; token?: string }>('/auth/register', input)
    storeToken(out.token)
    return out
  },
  login: async (input: { email: string; password: string }) => {
    const out = await post<{ user: Account; token?: string }>('/auth/login', input)
    storeToken(out.token)
    return out
  },
  logout: async () => {
    try {
      return await post<{ ok: true }>('/auth/logout')
    } finally {
      storeToken(null)
    }
  },
  updateProfile: (input: { name?: string; handicapIndex?: number | null; colorIndex?: number }) =>
    patch<{ user: Account }>('/auth/me', input),

  friends: () => get<FriendsPayload>('/friends'),
  addFriend: (email: string) => post<{ status: string; hasAccount: boolean }>('/friends', { email }),
  respondFriend: (id: string, action: 'accept' | 'decline') =>
    post<{ status: string }>('/friends/respond', { id, action }),

  leagues: () => get<{ leagues: League[] }>('/leagues'),
  createLeague: (input: { name: string; description?: string }) =>
    post<{ league: League }>('/leagues', input),
  joinLeague: (code: string) => post<{ id: string; name: string }>('/leagues/join', { code }),
  league: (id: string) => get<LeagueDetail>(`/leagues/${id}`),

  rounds: () => get<{ rounds: RoundSummary[] }>('/rounds'),
  createRound: (input: {
    gameId: string
    players: RoundPlayerDoc[]
    settings: Record<string, any>
    course: Record<string, any>
    gameState: Record<string, any>
    currentHole: number
    leagueId?: string | null
    title?: string | null
  }) => post<{ round: RoundDoc }>('/rounds', input),
  round: (id: string, version?: number) =>
    get<{ changed: boolean; version?: number; round?: RoundDoc }>(
      `/rounds/${id}${version ? `?version=${version}` : ''}`,
    ),
  patchRound: (
    id: string,
    input: {
      currentHole?: number
      status?: 'active' | 'finished'
      settings?: Record<string, any>
      gameState?: Record<string, any>
    },
  ) => patch<{ round: RoundDoc }>(`/rounds/${id}`, input),
  putHole: (
    id: string,
    input: { hole: number; scores?: Record<string, number | null>; game?: Record<string, any>; complete?: boolean },
  ) => put<{ round: RoundDoc }>(`/rounds/${id}/hole`, input),
  inviteToRound: (id: string, email: string) =>
    post<{ status: string; hasAccount: boolean; round?: RoundDoc }>(`/rounds/${id}/invite`, { email }),
  joinRound: (id: string) => post<{ round: RoundDoc }>(`/rounds/${id}/join`),

  invites: () => get<InvitesPayload>('/invites'),
}
