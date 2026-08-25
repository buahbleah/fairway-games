import { describe, expect, it } from 'vitest'
import { enqueue, layerPending, type Op } from './onlineRound'
import type { RoundDoc } from '../net/api'

/**
 * Regression tests for fast tapping on the score stepper.
 *
 * Reported: tapping + several times quickly lost taps, because each tap read
 * the value from the last render and the reply to an earlier write overwrote
 * what had been tapped since.
 */

const doc = (scores: Record<string, number | null>): RoundDoc => ({
  id: 'r1',
  leagueId: null,
  hostId: 'u1',
  gameId: 'skins',
  title: null,
  status: 'active',
  settings: {},
  course: {},
  gameState: {},
  currentHole: 1,
  version: 5,
  createdAt: '2026-08-25T10:00:00Z',
  updatedAt: '2026-08-25T10:00:00Z',
  players: [],
  entries: [{ hole: 1, scores, game: {}, complete: false }],
})

describe('A reply from the server', () => {
  it('does not undo a tap that happened while it was in flight', () => {
    // The server still thinks 4; the golfer has since tapped up to 6.
    const fromServer = doc({ marc: 4 })
    const pending: Op[] = [{ kind: 'hole', hole: 1, scores: { marc: 6 } }]

    const merged = layerPending(fromServer, pending)
    expect(merged.entries[0].scores.marc).toBe(6)
  })

  it('keeps other players as the server reported them', () => {
    const fromServer = doc({ marc: 4, phil: 5 })
    const pending: Op[] = [{ kind: 'hole', hole: 1, scores: { marc: 6 } }]

    const merged = layerPending(fromServer, pending)
    expect(merged.entries[0].scores).toEqual({ marc: 6, phil: 5 })
  })

  it('is taken as-is when nothing is waiting to be sent', () => {
    const fromServer = doc({ marc: 4 })
    expect(layerPending(fromServer, []).entries[0].scores.marc).toBe(4)
  })

  it('carries a pending hole the server has never seen', () => {
    const fromServer = doc({ marc: 4 })
    const pending: Op[] = [{ kind: 'hole', hole: 7, scores: { marc: 3 } }]

    const merged = layerPending(fromServer, pending)
    expect(merged.entries.map((e) => e.hole)).toEqual([1, 7])
    expect(merged.entries[1].scores.marc).toBe(3)
  })

  it('leaves round-level changes alone', () => {
    const fromServer = doc({ marc: 4 })
    const pending: Op[] = [{ kind: 'round', currentHole: 9 }]
    expect(layerPending(fromServer, pending)).toEqual(fromServer)
  })
})

describe('A burst of taps', () => {
  it('becomes a single request carrying the last value', () => {
    // Four taps on + in under a second.
    let q: Op[] = []
    for (const v of [5, 6, 7, 8]) {
      q = enqueue(q, { kind: 'hole', hole: 1, scores: { marc: v } })
    }
    expect(q).toHaveLength(1)
    expect((q[0] as Extract<Op, { kind: 'hole' }>).scores).toEqual({ marc: 8 })
  })

  it('keeps every player when several are tapped at once', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 1, scores: { marc: 5 } })
    q = enqueue(q, { kind: 'hole', hole: 1, scores: { phil: 4 } })
    q = enqueue(q, { kind: 'hole', hole: 1, scores: { marc: 6 } })
    expect(q).toHaveLength(1)
    expect((q[0] as Extract<Op, { kind: 'hole' }>).scores).toEqual({ marc: 6, phil: 4 })
  })
})
