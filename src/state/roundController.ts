import { useCallback, useMemo } from 'react'
import type { HoleEntry, Round } from '../core/types'
import { useStore } from './store'
import { api } from '../net/api'
import { useOnlineRound, type SyncState } from './onlineRound'

/**
 * One interface over the two kinds of round: the local one on this phone and
 * the shared one on the server. The Play screen talks only to this, so nothing
 * in the gameplay UI knows or cares whether a round is online.
 *
 * Local round ids are prefixed `round_`; server ids are UUIDs. That is the
 * whole routing rule.
 */

export interface RoundController {
  round: Round | null
  online: boolean
  loading: boolean
  error: string | null
  sync: SyncState
  pending: number
  canUndo: boolean
  undoLabel: string | null
  setScore: (hole: number, playerId: string, value: number | null) => void
  patchEntry: (hole: number, patch: Partial<HoleEntry>) => void
  completeHole: (hole: number) => void
  goToHole: (hole: number) => void
  patchGameState: (patch: Record<string, any>) => void
  finish: () => void
  reopen: () => void
  /** Throw the round away for good. Leaving without discarding keeps it. */
  discard: () => Promise<void>
  undo: () => string | null
}

export function isOnlineRoundId(id: string | null | undefined): boolean {
  return !!id && !id.startsWith('round_')
}

export function useRoundController(roundId: string | null): RoundController {
  const store = useStore()
  const online = isOnlineRoundId(roundId)
  const remote = useOnlineRound(online ? roundId : null)

  const localRound = !online && roundId ? (store.getRound(roundId) ?? null) : null

  const setScore = useCallback(
    (hole: number, playerId: string, value: number | null) => {
      if (online) remote.setScore(hole, playerId, value)
      else if (roundId) store.setScore(roundId, hole, playerId, value)
    },
    [online, remote, store, roundId],
  )

  const patchEntry = useCallback(
    (hole: number, patch: Partial<HoleEntry>) => {
      if (online) remote.patchEntry(hole, patch)
      else if (roundId) store.patchEntry(roundId, hole, patch)
    },
    [online, remote, store, roundId],
  )

  const completeHole = useCallback(
    (hole: number) => {
      if (online) {
        remote.completeHole(hole)
        return
      }
      if (!roundId) return
      const round = store.getRound(roundId)
      const entry = round?.entries.find((e) => e.hole === hole)
      if (entry) store.completeHole(roundId, entry)
    },
    [online, remote, store, roundId],
  )

  const goToHole = useCallback(
    (hole: number) => {
      if (online) remote.goToHole(hole)
      else if (roundId) store.goToHole(roundId, hole)
    },
    [online, remote, store, roundId],
  )

  const patchGameState = useCallback(
    (patch: Record<string, any>) => {
      if (online) remote.patchGameState(patch)
      else if (roundId) store.patchGameState(roundId, patch)
    },
    [online, remote, store, roundId],
  )

  const finish = useCallback(() => {
    if (online) remote.setStatus('finished')
    else if (roundId) store.finishRound(roundId)
  }, [online, remote, store, roundId])

  const reopen = useCallback(() => {
    if (online) remote.setStatus('active')
    else if (roundId) store.reopenRound(roundId)
  }, [online, remote, store, roundId])

  const discard = useCallback(async () => {
    if (!roundId) return
    if (online) {
      try {
        await api.deleteRound(roundId)
      } finally {
        // Drop the local copy either way; a round the golfer chose to throw away
        // should not reappear from the mirror on the next open.
        try {
          localStorage.removeItem(`fairway.mirror.${roundId}`)
          localStorage.removeItem(`fairway.queue.${roundId}`)
        } catch {
          /* storage blocked */
        }
      }
      return
    }
    store.deleteRound(roundId)
  }, [online, store, roundId])

  const undo = useCallback((): string | null => {
    if (online) return remote.undo()
    return roundId ? store.undo(roundId) : null
  }, [online, remote, store, roundId])

  return useMemo<RoundController>(
    () => ({
      round: online ? remote.round : localRound,
      online,
      loading: online ? remote.loading : false,
      error: online ? remote.error : null,
      sync: online ? remote.sync : 'idle',
      pending: online ? remote.pending : 0,
      canUndo: online ? remote.canUndo : roundId ? store.canUndo(roundId) : false,
      undoLabel: online ? null : roundId ? store.undoLabel(roundId) : null,
      setScore,
      patchEntry,
      completeHole,
      goToHole,
      patchGameState,
      finish,
      reopen,
      discard,
      undo,
    }),
    [
      online,
      remote.round,
      remote.loading,
      remote.error,
      remote.sync,
      remote.pending,
      remote.canUndo,
      localRound,
      roundId,
      store,
      setScore,
      patchEntry,
      completeHole,
      goToHole,
      patchGameState,
      finish,
      reopen,
      discard,
      undo,
    ],
  )
}
