import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Course, GameId, HoleEntry, Player, Round, SettingsValues } from '../core/types'
import { getGame } from '../games/registry'
import { defaultCourse } from '../core/course'

/**
 * All state lives here and is mirrored into localStorage on every change, so the
 * app survives a locked phone, a dead battery or no signal at all. There is no
 * network call anywhere in this file — offline is the default, not a mode.
 */

const STORAGE_KEY = 'fairway.v1'
const UNDO_LIMIT = 25

export interface GamePreset {
  id: string
  gameId: GameId
  name: string
  settings: SettingsValues
  createdAt: number
}

export interface Prefs {
  theme: 'system' | 'light' | 'dark'
  contrast: 'normal' | 'sunlight'
  haptics: boolean
  currency: string
}

interface UndoSnapshot {
  entries: HoleEntry[]
  currentHole: number
  gameState: Record<string, any>
  label: string
}

interface PersistedState {
  version: 1
  rounds: Round[]
  roster: Player[]
  /** Cards typed in by hand, kept so a home course is entered once. */
  courses: Course[]
  presets: GamePreset[]
  prefs: Prefs
  undo: Record<string, UndoSnapshot[]>
}

const DEFAULT_PREFS: Prefs = { theme: 'system', contrast: 'normal', haptics: true, currency: 'CHF' }

function emptyState(): PersistedState {
  return { version: 1, rounds: [], roster: [], courses: [], presets: [], prefs: DEFAULT_PREFS, undo: {} }
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as PersistedState
    return {
      ...emptyState(),
      ...parsed,
      prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) },
      undo: parsed.undo ?? {},
    }
  } catch {
    return emptyState()
  }
}

function save(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* Storage full or blocked — the round stays alive in memory regardless. */
  }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

/* ------------------------------------------------------------------- context */

interface StoreValue {
  rounds: Round[]
  roster: Player[]
  courses: Course[]
  presets: GamePreset[]
  prefs: Prefs
  activeRound: Round | null
  getRound: (id: string) => Round | undefined
  canUndo: (roundId: string) => boolean
  undoLabel: (roundId: string) => string | null

  createRound: (input: {
    gameId: GameId
    players: Player[]
    settings: SettingsValues
    course?: Round['course']
    title?: string
    gameState?: Record<string, any>
  }) => Round
  updateRound: (id: string, patch: Partial<Round>, undoLabel?: string) => void
  setEntry: (roundId: string, entry: HoleEntry, undoLabel?: string) => void
  /** Merges into whatever the entry holds right now — safe against fast taps. */
  patchEntry: (roundId: string, hole: number, patch: Partial<HoleEntry>, undoLabel?: string) => void
  setScore: (roundId: string, hole: number, playerId: string, value: number | null) => void
  /** Nudge a score, computed inside the updater so fast taps all count. */
  adjustScore: (roundId: string, hole: number, playerId: string, delta: number, fallback: number) => void
  patchGameState: (roundId: string, patch: Record<string, any>, undoLabel?: string) => void
  completeHole: (roundId: string, entry: HoleEntry) => void
  goToHole: (roundId: string, hole: number) => void
  undo: (roundId: string) => string | null
  finishRound: (roundId: string) => void
  reopenRound: (roundId: string) => void
  deleteRound: (roundId: string) => void

  saveRosterPlayer: (player: Player) => void
  removeRosterPlayer: (id: string) => void

  /** A card typed in by hand, so a home course is entered once and reused. */
  saveCourse: (course: Course) => void
  deleteCourse: (id: string) => void
  savePreset: (preset: Omit<GamePreset, 'id' | 'createdAt'>) => GamePreset
  deletePreset: (id: string) => void

  setPrefs: (patch: Partial<Prefs>) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => load())
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    save(state)
  }, [state])

  // Theme is applied to <html> so tokens.css can switch entire palettes.
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = state.prefs.theme === 'dark' || (state.prefs.theme === 'system' && sys)
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
      root.setAttribute('data-contrast', state.prefs.contrast)
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', dark ? '#0a1310' : '#f8f4ea')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [state.prefs.theme, state.prefs.contrast])

  const mutate = useCallback((fn: (s: PersistedState) => PersistedState) => {
    setState((prev) => fn(prev))
  }, [])

  const pushUndo = useCallback((s: PersistedState, round: Round, label: string): PersistedState => {
    const stack = s.undo[round.id] ?? []
    const snapshot: UndoSnapshot = {
      entries: JSON.parse(JSON.stringify(round.entries)),
      currentHole: round.currentHole,
      gameState: JSON.parse(JSON.stringify(round.gameState ?? {})),
      label,
    }
    return { ...s, undo: { ...s.undo, [round.id]: [...stack, snapshot].slice(-UNDO_LIMIT) } }
  }, [])

  const value = useMemo<StoreValue>(() => {
    const getRound = (id: string) => stateRef.current.rounds.find((r) => r.id === id)

    return {
      rounds: state.rounds,
      roster: state.roster,
      courses: state.courses ?? [],
      presets: state.presets,
      prefs: state.prefs,
      activeRound: state.rounds.find((r) => r.status === 'active') ?? null,
      getRound,
      canUndo: (roundId) => (state.undo[roundId]?.length ?? 0) > 0,
      undoLabel: (roundId) => {
        const stack = state.undo[roundId] ?? []
        return stack.length ? stack[stack.length - 1].label : null
      },

      createRound: ({ gameId, players, settings, course, title, gameState }) => {
        const game = getGame(gameId)
        const useCourse = course ?? defaultCourse()
        const round: Round = {
          id: uid('round'),
          gameId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'active',
          title,
          players,
          course: useCourse,
          settings,
          entries: [],
          currentHole: useCourse.holes[0]?.number ?? 1,
          gameState: {
            ...game.createRoundState({ players, course: useCourse, settings }),
            ...(gameState ?? {}),
          },
        }
        mutate((s) => ({
          ...s,
          // Only one round is live at a time; older live rounds are archived.
          rounds: [round, ...s.rounds.map((r) => (r.status === 'active' ? { ...r, status: 'finished' as const } : r))],
        }))
        return round
      },

      updateRound: (id, patch, undoLabel) => {
        mutate((s) => {
          const round = s.rounds.find((r) => r.id === id)
          if (!round) return s
          const next = undoLabel ? pushUndo(s, round, undoLabel) : s
          return {
            ...next,
            rounds: next.rounds.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)),
          }
        })
      },

      setEntry: (roundId, entry, undoLabel) => {
        mutate((s) => {
          const round = s.rounds.find((r) => r.id === roundId)
          if (!round) return s
          const next = undoLabel ? pushUndo(s, round, undoLabel) : s
          const entries = [...round.entries.filter((e) => e.hole !== entry.hole), entry].sort(
            (a, b) => a.hole - b.hole,
          )
          return {
            ...next,
            rounds: next.rounds.map((r) => (r.id === roundId ? { ...r, entries, updatedAt: Date.now() } : r)),
          }
        })
      },

      patchEntry: (roundId, hole, patch, undoLabel) => {
        mutate((s) => {
          const round = s.rounds.find((r) => r.id === roundId)
          if (!round) return s
          const next = undoLabel ? pushUndo(s, round, undoLabel) : s
          return {
            ...next,
            rounds: next.rounds.map((r) => {
              if (r.id !== roundId) return r
              const existing = r.entries.find((e) => e.hole === hole)
              const base: HoleEntry =
                existing ?? {
                  hole,
                  scores: Object.fromEntries(r.players.map((p) => [p.id, null])),
                  complete: false,
                }
              const merged: HoleEntry = {
                ...base,
                ...patch,
                scores: { ...base.scores, ...(patch.scores ?? {}) },
                game: { ...(base.game ?? {}), ...(patch.game ?? {}) },
              }
              const entries = [...r.entries.filter((e) => e.hole !== hole), merged].sort((a, b) => a.hole - b.hole)
              return { ...r, entries, updatedAt: Date.now() }
            }),
          }
        })
      },

      setScore: (roundId, hole, playerId, value) => {
        mutate((s) => ({
          ...s,
          rounds: s.rounds.map((r) => {
            if (r.id !== roundId) return r
            const existing = r.entries.find((e) => e.hole === hole)
            const base: HoleEntry =
              existing ?? {
                hole,
                scores: Object.fromEntries(r.players.map((p) => [p.id, null])),
                complete: false,
              }
            const merged: HoleEntry = { ...base, scores: { ...base.scores, [playerId]: value } }
            const entries = [...r.entries.filter((e) => e.hole !== hole), merged].sort((a, b) => a.hole - b.hole)
            return { ...r, entries, updatedAt: Date.now() }
          }),
        }))
      },

      adjustScore: (roundId, hole, playerId, delta, fallback) => {
        mutate((s) => ({
          ...s,
          rounds: s.rounds.map((r) => {
            if (r.id !== roundId) return r
            const existing = r.entries.find((e) => e.hole === hole)
            const base: HoleEntry =
              existing ?? {
                hole,
                scores: Object.fromEntries(r.players.map((p) => [p.id, null])),
                complete: false,
              }
            const current = base.scores[playerId]
            const next = Math.max(1, Math.min(20, (current ?? fallback) + delta))
            const merged: HoleEntry = { ...base, scores: { ...base.scores, [playerId]: next } }
            const entries = [...r.entries.filter((e) => e.hole !== hole), merged].sort((a, b) => a.hole - b.hole)
            return { ...r, entries, updatedAt: Date.now() }
          }),
        }))
      },

      patchGameState: (roundId, patch, undoLabel) => {
        mutate((s) => {
          const round = s.rounds.find((r) => r.id === roundId)
          if (!round) return s
          const next = undoLabel ? pushUndo(s, round, undoLabel) : s
          return {
            ...next,
            rounds: next.rounds.map((r) =>
              r.id === roundId
                ? { ...r, gameState: { ...(r.gameState ?? {}), ...patch }, updatedAt: Date.now() }
                : r,
            ),
          }
        })
      },

      completeHole: (roundId, entry) => {
        mutate((s) => {
          const round = s.rounds.find((r) => r.id === roundId)
          if (!round) return s
          const next = pushUndo(s, round, `Hole ${entry.hole}`)
          const entries = [...round.entries.filter((e) => e.hole !== entry.hole), { ...entry, complete: true }].sort(
            (a, b) => a.hole - b.hole,
          )
          // The hole stays on screen so its result can be shown. Moving on is
          // an explicit tap — nothing scrolls away underneath the golfer.
          return {
            ...next,
            rounds: next.rounds.map((r) => (r.id === roundId ? { ...r, entries, updatedAt: Date.now() } : r)),
          }
        })
      },

      goToHole: (roundId, hole) => {
        mutate((s) => ({
          ...s,
          rounds: s.rounds.map((r) => (r.id === roundId ? { ...r, currentHole: hole } : r)),
        }))
      },

      undo: (roundId) => {
        const stack = stateRef.current.undo[roundId] ?? []
        if (!stack.length) return null
        const snapshot = stack[stack.length - 1]
        mutate((s) => ({
          ...s,
          undo: { ...s.undo, [roundId]: (s.undo[roundId] ?? []).slice(0, -1) },
          rounds: s.rounds.map((r) =>
            r.id === roundId
              ? {
                  ...r,
                  entries: snapshot.entries,
                  currentHole: snapshot.currentHole,
                  gameState: snapshot.gameState,
                  updatedAt: Date.now(),
                }
              : r,
          ),
        }))
        return snapshot.label
      },

      finishRound: (roundId) => {
        mutate((s) => ({
          ...s,
          rounds: s.rounds.map((r) => (r.id === roundId ? { ...r, status: 'finished', updatedAt: Date.now() } : r)),
        }))
      },

      reopenRound: (roundId) => {
        mutate((s) => ({
          ...s,
          rounds: s.rounds.map((r) =>
            r.id === roundId
              ? { ...r, status: 'active', updatedAt: Date.now() }
              : r.status === 'active'
                ? { ...r, status: 'finished' }
                : r,
          ),
        }))
      },

      deleteRound: (roundId) => {
        mutate((s) => {
          const { [roundId]: _dropped, ...undo } = s.undo
          return { ...s, rounds: s.rounds.filter((r) => r.id !== roundId), undo }
        })
      },

      saveRosterPlayer: (player) => {
        mutate((s) => ({
          ...s,
          roster: s.roster.some((p) => p.id === player.id)
            ? s.roster.map((p) => (p.id === player.id ? player : p))
            : [...s.roster, player],
        }))
      },

      removeRosterPlayer: (id) => {
        mutate((s) => ({ ...s, roster: s.roster.filter((p) => p.id !== id) }))
      },

      saveCourse: (course) => {
        mutate((s) => ({
          ...s,
          courses: (s.courses ?? []).some((c) => c.id === course.id)
            ? (s.courses ?? []).map((c) => (c.id === course.id ? course : c))
            : [...(s.courses ?? []), course],
        }))
      },

      deleteCourse: (id) => {
        mutate((s) => ({ ...s, courses: (s.courses ?? []).filter((c) => c.id !== id) }))
      },

      savePreset: (preset) => {
        const full: GamePreset = { ...preset, id: uid('preset'), createdAt: Date.now() }
        mutate((s) => ({ ...s, presets: [...s.presets, full] }))
        return full
      },

      deletePreset: (id) => {
        mutate((s) => ({ ...s, presets: s.presets.filter((p) => p.id !== id) }))
      },

      setPrefs: (patch) => {
        mutate((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }))
      },
    }
  }, [state, mutate, pushUndo])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** Short, selective haptic feedback. Never on every tap. */
export function haptic(kind: 'light' | 'medium' | 'success' = 'light', enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  const pattern = kind === 'success' ? [12, 40, 18] : kind === 'medium' ? 18 : 9
  try {
    navigator.vibrate(pattern)
  } catch {
    /* nothing to do */
  }
}
