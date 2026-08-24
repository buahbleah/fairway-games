import { describe, expect, it } from 'vitest'
import { docToRound, enqueue, type Op } from './onlineRound'
import type { RoundDoc } from '../net/api'

/**
 * The offline write queue is the part of live scoring that has to be right:
 * whatever four phones do in patchy coverage, nobody's score may be lost.
 */

describe('The write queue', () => {
  it('keeps a single write as it is', () => {
    const q = enqueue([], { kind: 'hole', hole: 3, scores: { p1: 4 } })
    expect(q).toHaveLength(1)
  })

  it('folds repeated taps on the same hole into one request', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 3, scores: { p1: 4 } })
    q = enqueue(q, { kind: 'hole', hole: 3, scores: { p2: 5 } })
    q = enqueue(q, { kind: 'hole', hole: 3, scores: { p1: 5 } })
    expect(q).toHaveLength(1)
    const op = q[0] as Extract<Op, { kind: 'hole' }>
    // Latest value per player wins; the other player's score is untouched.
    expect(op.scores).toEqual({ p1: 5, p2: 5 })
  })

  it('keeps different holes apart', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 3, scores: { p1: 4 } })
    q = enqueue(q, { kind: 'hole', hole: 4, scores: { p1: 5 } })
    expect(q).toHaveLength(2)
  })

  it('remembers that a hole was confirmed', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 3, scores: { p1: 4 } })
    q = enqueue(q, { kind: 'hole', hole: 3, complete: true })
    const op = q[0] as Extract<Op, { kind: 'hole' }>
    expect(op.complete).toBe(true)
    expect(op.scores).toEqual({ p1: 4 })
  })

  it('merges the game payload rather than replacing it', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 5, game: { wolfId: 'p1', mode: 'partner' } })
    q = enqueue(q, { kind: 'hole', hole: 5, game: { partnerId: 'p2' } })
    const op = q[0] as Extract<Op, { kind: 'hole' }>
    expect(op.game).toEqual({ wolfId: 'p1', mode: 'partner', partnerId: 'p2' })
  })

  it('collapses round-level changes into one op', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'round', currentHole: 4 })
    q = enqueue(q, { kind: 'round', currentHole: 5 })
    q = enqueue(q, { kind: 'round', gameState: { presses: [1] } })
    expect(q).toHaveLength(1)
    const op = q[0] as Extract<Op, { kind: 'round' }>
    expect(op.currentHole).toBe(5)
    expect(op.gameState).toEqual({ presses: [1] })
  })

  it('does not let a round op swallow a hole op', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 2, scores: { p1: 3 } })
    q = enqueue(q, { kind: 'round', currentHole: 3 })
    expect(q).toHaveLength(2)
    expect(q[0].kind).toBe('hole')
  })

  it('preserves the order holes were played in', () => {
    let q: Op[] = []
    q = enqueue(q, { kind: 'hole', hole: 1, scores: { p1: 4 } })
    q = enqueue(q, { kind: 'hole', hole: 2, scores: { p1: 4 } })
    q = enqueue(q, { kind: 'hole', hole: 1, complete: true })
    expect(q.map((o) => (o.kind === 'hole' ? o.hole : 0))).toEqual([1, 2])
  })
})

describe('Turning a server round into a playable one', () => {
  const doc: RoundDoc = {
    id: 'abc',
    leagueId: null,
    hostId: 'u1',
    gameId: 'wolf',
    title: null,
    status: 'active',
    settings: { wolfTeamWinPoints: 2 },
    course: {},
    gameState: { rotation: ['a', 'b'] },
    currentHole: 3,
    version: 7,
    createdAt: '2026-08-24T10:00:00Z',
    updatedAt: '2026-08-24T10:30:00Z',
    players: [
      { id: 'a', userId: 'u1', name: 'Marc', handicapIndex: 11.4, colorIndex: 0 },
      { id: 'b', userId: null, name: 'Phil', handicapIndex: null, colorIndex: 1 },
    ],
    entries: [{ hole: 1, scores: { a: 4, b: 5 }, game: { mode: 'lone' }, complete: true }],
  }

  it('maps players, entries and state across', () => {
    const round = docToRound(doc)
    expect(round.players.map((p) => p.name)).toEqual(['Marc', 'Phil'])
    expect(round.entries[0].scores).toEqual({ a: 4, b: 5 })
    expect(round.currentHole).toBe(3)
    expect(round.gameState.rotation).toEqual(['a', 'b'])
  })

  it('falls back to a standard card when the round has no course', () => {
    const round = docToRound(doc)
    expect(round.course.holes).toHaveLength(18)
  })

  it('keeps a real course when one was stored', () => {
    const withCourse = {
      ...doc,
      course: { id: 'c', name: 'Nine', holes: [{ number: 1, par: 3, strokeIndex: 1 }] },
    }
    expect(docToRound(withCourse).course.holes).toHaveLength(1)
  })
})
