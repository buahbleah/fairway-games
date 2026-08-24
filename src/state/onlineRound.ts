import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, type RoundDoc } from '../net/api'
import { defaultCourse } from '../core/course'
import type { GameId, HoleEntry, Round } from '../core/types'

/**
 * A shared round, kept usable with no signal.
 *
 * Writes are applied to a local mirror immediately and appended to a queue that
 * is flushed whenever the phone has a connection. The server merges hole scores
 * key by key, so replaying a queued write never clobbers what somebody else
 * entered in the meantime — which is exactly the case that matters when four
 * people are scoring the same hole from four phones in patchy coverage.
 */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export type Op =
  | { kind: 'hole'; hole: number; scores?: Record<string, number | null>; game?: Record<string, any>; complete?: boolean }
  | { kind: 'round'; currentHole?: number; status?: 'active' | 'finished'; settings?: Record<string, any>; gameState?: Record<string, any> }

const QUEUE_KEY = (id: string) => `fairway.queue.${id}`
const MIRROR_KEY = (id: string) => `fairway.mirror.${id}`
const POLL_MS = 4000

/* ---------------------------------------------------------------- mapping */

export function docToRound(doc: RoundDoc): Round {
  const course =
    doc.course && Array.isArray((doc.course as any).holes) && (doc.course as any).holes.length
      ? (doc.course as any)
      : defaultCourse()

  return {
    id: doc.id,
    gameId: doc.gameId as GameId,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
    status: doc.status,
    title: doc.title ?? undefined,
    players: doc.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      handicapIndex: p.handicapIndex,
      colorIndex: p.colorIndex ?? i,
    })),
    course,
    settings: doc.settings ?? {},
    entries: doc.entries.map((e) => ({
      hole: e.hole,
      scores: e.scores ?? {},
      game: e.game ?? {},
      complete: e.complete,
    })),
    currentHole: doc.currentHole,
    gameState: doc.gameState ?? {},
    leagueId: doc.leagueId,
  }
}

/* ------------------------------------------------------------ persistence */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* nothing sensible to do; the round still works in memory */
  }
}

/** Folds a new op into the queue so a burst of taps becomes one request. */
export function enqueue(queue: Op[], op: Op): Op[] {
  if (op.kind === 'hole') {
    const idx = queue.findIndex((q) => q.kind === 'hole' && q.hole === op.hole)
    if (idx >= 0) {
      const prev = queue[idx] as Extract<Op, { kind: 'hole' }>
      const merged: Op = {
        kind: 'hole',
        hole: op.hole,
        scores: { ...(prev.scores ?? {}), ...(op.scores ?? {}) },
        game: { ...(prev.game ?? {}), ...(op.game ?? {}) },
        complete: op.complete ?? prev.complete,
      }
      const next = [...queue]
      next[idx] = merged
      return next
    }
    return [...queue, op]
  }

  const idx = queue.findIndex((q) => q.kind === 'round')
  if (idx >= 0) {
    const prev = queue[idx] as Extract<Op, { kind: 'round' }>
    const next = [...queue]
    next[idx] = {
      kind: 'round',
      currentHole: op.currentHole ?? prev.currentHole,
      status: op.status ?? prev.status,
      settings: op.settings ?? prev.settings,
      gameState: { ...(prev.gameState ?? {}), ...(op.gameState ?? {}) },
    }
    return next
  }
  return [...queue, op]
}

/* -------------------------------------------------------------------- hook */

export interface OnlineRound {
  round: Round | null
  loading: boolean
  error: string | null
  sync: SyncState
  pending: number
  setScore: (hole: number, playerId: string, value: number | null) => void
  patchEntry: (hole: number, patch: Partial<HoleEntry>) => void
  completeHole: (hole: number) => void
  goToHole: (hole: number) => void
  patchGameState: (patch: Record<string, any>) => void
  setStatus: (status: 'active' | 'finished') => void
  undo: () => string | null
  canUndo: boolean
  refresh: () => Promise<void>
}

export function useOnlineRound(roundId: string | null): OnlineRound {
  const [doc, setDoc] = useState<RoundDoc | null>(() =>
    roundId ? readJson<RoundDoc | null>(MIRROR_KEY(roundId), null) : null,
  )
  const [loading, setLoading] = useState(!!roundId)
  const [error, setError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncState>('idle')
  const [queue, setQueue] = useState<Op[]>(() => (roundId ? readJson<Op[]>(QUEUE_KEY(roundId), []) : []))
  const [undoStack, setUndoStack] = useState<{ label: string; op: Op }[]>([])

  const queueRef = useRef(queue)
  queueRef.current = queue
  const docRef = useRef(doc)
  docRef.current = doc
  const flushing = useRef(false)

  const persistQueue = useCallback(
    (next: Op[]) => {
      setQueue(next)
      if (roundId) writeJson(QUEUE_KEY(roundId), next)
    },
    [roundId],
  )

  const persistDoc = useCallback(
    (next: RoundDoc) => {
      setDoc(next)
      if (roundId) writeJson(MIRROR_KEY(roundId), next)
    },
    [roundId],
  )

  /* --------------------------------------------------------------- flush */

  const flush = useCallback(async () => {
    if (!roundId || flushing.current) return
    if (!queueRef.current.length) return
    flushing.current = true
    setSync('syncing')
    try {
      while (queueRef.current.length) {
        const op = queueRef.current[0]
        const result =
          op.kind === 'hole'
            ? await api.putHole(roundId, {
                hole: op.hole,
                scores: op.scores,
                game: op.game,
                complete: op.complete,
              })
            : await api.patchRound(roundId, {
                currentHole: op.currentHole,
                status: op.status,
                settings: op.settings,
                gameState: op.gameState,
              })
        persistDoc(result.round)
        persistQueue(queueRef.current.slice(1))
      }
      setSync('idle')
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.offline) {
        setSync('offline')
      } else {
        setSync('error')
        setError(err instanceof Error ? err.message : 'Could not save that.')
        // A rejected write would otherwise be retried forever.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          persistQueue(queueRef.current.slice(1))
        }
      }
    } finally {
      flushing.current = false
    }
  }, [roundId, persistDoc, persistQueue])

  /* ---------------------------------------------------------------- load */

  const refresh = useCallback(async () => {
    if (!roundId) return
    try {
      const version = docRef.current?.version
      const result = await api.round(roundId, queueRef.current.length ? undefined : version)
      if (result.changed && result.round) persistDoc(result.round)
      setError(null)
      setSync((s) => (s === 'offline' ? 'idle' : s))
    } catch (err) {
      if (err instanceof ApiError && err.offline) setSync('offline')
      else if (err instanceof ApiError && err.status === 404) setError('That round has been deleted.')
      else if (err instanceof ApiError && err.status === 403) setError('You are not in that round.')
    } finally {
      setLoading(false)
    }
  }, [roundId, persistDoc])

  useEffect(() => {
    if (!roundId) return
    setLoading(!readJson<RoundDoc | null>(MIRROR_KEY(roundId), null))
    void refresh()
  }, [roundId, refresh])

  // Poll while the round is open and the screen is actually being looked at.
  useEffect(() => {
    if (!roundId) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void flush()
      void refresh()
    }
    const timer = window.setInterval(tick, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    const onOnline = () => tick()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [roundId, flush, refresh])

  /* ----------------------------------------------------------- mutations */

  const applyLocal = useCallback(
    (mutate: (d: RoundDoc) => RoundDoc) => {
      const current = docRef.current
      if (!current) return
      persistDoc(mutate(current))
    },
    [persistDoc],
  )

  const push = useCallback(
    (op: Op) => {
      const next = enqueue(queueRef.current, op)
      persistQueue(next)
      void flush()
    },
    [persistQueue, flush],
  )

  const entryFor = (d: RoundDoc, hole: number) =>
    d.entries.find((e) => e.hole === hole) ?? { hole, scores: {}, game: {}, complete: false }

  const rememberUndo = useCallback((label: string, hole: number) => {
    const d = docRef.current
    if (!d) return
    const before = entryFor(d, hole)
    setUndoStack((s) =>
      [...s, { label, op: { kind: 'hole' as const, hole, scores: { ...before.scores }, game: { ...before.game }, complete: before.complete } }].slice(-25),
    )
  }, [])

  const setScore = useCallback(
    (hole: number, playerId: string, value: number | null) => {
      applyLocal((d) => {
        const before = entryFor(d, hole)
        const entry = { ...before, scores: { ...before.scores, [playerId]: value } }
        return { ...d, entries: [...d.entries.filter((e) => e.hole !== hole), entry].sort((a, b) => a.hole - b.hole) }
      })
      push({ kind: 'hole', hole, scores: { [playerId]: value } })
    },
    [applyLocal, push],
  )

  const patchEntry = useCallback(
    (hole: number, patch: Partial<HoleEntry>) => {
      applyLocal((d) => {
        const before = entryFor(d, hole)
        const entry = {
          ...before,
          ...patch,
          scores: { ...before.scores, ...(patch.scores ?? {}) },
          game: { ...before.game, ...(patch.game ?? {}) },
        }
        return { ...d, entries: [...d.entries.filter((e) => e.hole !== hole), entry].sort((a, b) => a.hole - b.hole) }
      })
      push({ kind: 'hole', hole, scores: patch.scores, game: patch.game, complete: patch.complete })
    },
    [applyLocal, push],
  )

  const completeHole = useCallback(
    (hole: number) => {
      rememberUndo(`Hole ${hole}`, hole)
      applyLocal((d) => {
        const before = entryFor(d, hole)
        return {
          ...d,
          entries: [...d.entries.filter((e) => e.hole !== hole), { ...before, complete: true }].sort(
            (a, b) => a.hole - b.hole,
          ),
        }
      })
      push({ kind: 'hole', hole, complete: true })
    },
    [applyLocal, push, rememberUndo],
  )

  const goToHole = useCallback(
    (hole: number) => {
      applyLocal((d) => ({ ...d, currentHole: hole }))
      push({ kind: 'round', currentHole: hole })
    },
    [applyLocal, push],
  )

  const patchGameState = useCallback(
    (patch: Record<string, any>) => {
      applyLocal((d) => ({ ...d, gameState: { ...d.gameState, ...patch } }))
      push({ kind: 'round', gameState: patch })
    },
    [applyLocal, push],
  )

  const setStatus = useCallback(
    (status: 'active' | 'finished') => {
      applyLocal((d) => ({ ...d, status }))
      push({ kind: 'round', status })
    },
    [applyLocal, push],
  )

  const undo = useCallback((): string | null => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return null
    setUndoStack((s) => s.slice(0, -1))
    const op = last.op as Extract<Op, { kind: 'hole' }>
    applyLocal((d) => ({
      ...d,
      entries: [
        ...d.entries.filter((e) => e.hole !== op.hole),
        { hole: op.hole, scores: op.scores ?? {}, game: op.game ?? {}, complete: !!op.complete },
      ].sort((a, b) => a.hole - b.hole),
    }))
    push(op)
    return last.label
  }, [undoStack, applyLocal, push])

  const round = useMemo(() => (doc ? docToRound(doc) : null), [doc])

  return {
    round,
    loading,
    error,
    sync,
    pending: queue.length,
    setScore,
    patchEntry,
    completeHole,
    goToHole,
    patchGameState,
    setStatus,
    undo,
    canUndo: undoStack.length > 0,
    refresh,
  }
}
