import { describe, expect, it } from 'vitest'
import { formatMatchResult, teamMatchGame, teamsForHole, type MatchState } from './index'
import { entry, makeCtx, makePlayers } from '../testUtils'
import type { GameContext, HoleEntry } from '../../core/types'

const players = makePlayers(['Marc', 'Phil', 'Mike', 'John'])
const [marc, phil, mike, john] = players.map((p) => p.id)
const ctx = (settings: Record<string, any> = {}) => makeCtx(teamMatchGame, players, settings)

/** A = team green wins, B = team sand wins, H = halved. */
function hole(h: number, who: 'A' | 'B' | 'H'): HoleEntry {
  if (who === 'A') return entry(h, players, [4, 6, 5, 5])
  if (who === 'B') return entry(h, players, [5, 5, 4, 6])
  return entry(h, players, [4, 6, 4, 5])
}

function pointsWon(outcomes: { points: Record<string, number> }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const o of outcomes) for (const [id, v] of Object.entries(o.points)) out[id] = (out[id] ?? 0) + v
  return out
}

function state(c: GameContext, entries: HoleEntry[]): MatchState {
  return teamMatchGame.compute(c, entries).extra?.match as MatchState
}

describe('Team Match Play — winning holes', () => {
  it('goes 1 up when a team wins a hole', () => {
    const s = state(ctx(), [hole(1, 'A')])
    expect(s.diff).toBe(1)
    expect(s.status).toBe('1 UP')
  })

  it('uses the better ball of each pair', () => {
    // Marc 4 (good), Phil 6 (bad) v Mike 5, John 5 -> Green wins with the 4.
    const s = state(ctx(), [hole(1, 'A')])
    expect(s.won).toEqual([1, 0])
  })

  it('halves a hole when the better balls match', () => {
    const s = state(ctx(), [hole(1, 'H')])
    expect(s.diff).toBe(0)
    expect(s.status).toBe('AS')
    expect(s.halved).toBe(1)
  })

  it('returns to all square when the other team wins one back', () => {
    const s = state(ctx(), [hole(1, 'A'), hole(2, 'B')])
    expect(s.diff).toBe(0)
    expect(s.status).toBe('AS')
  })

  it('does not care how big the win on a hole was', () => {
    const blowout = entry(1, players, [3, 9, 9, 9])
    const narrow = entry(2, players, [4, 9, 5, 9])
    const s = state(ctx(), [blowout, narrow])
    expect(s.diff).toBe(2)
  })
})

describe('Team Match Play — result notation', () => {
  it('formats a live match', () => {
    expect(formatMatchResult(0, 5, false)).toBe('AS')
    expect(formatMatchResult(2, 5, false)).toBe('2 UP')
    expect(formatMatchResult(-3, 5, false)).toBe('3 UP')
  })

  it('formats a closed-out match as "4 & 3"', () => {
    expect(formatMatchResult(4, 3, true)).toBe('4 & 3')
    expect(formatMatchResult(-2, 1, true)).toBe('2 & 1')
  })

  it('formats a match that went the distance', () => {
    expect(formatMatchResult(1, 0, true)).toBe('1 up')
    expect(formatMatchResult(0, 0, true)).toBe('Halved')
  })

  it('closes the match out early', () => {
    // Green wins holes 1-4, halves 5-15: 4 up with 3 to play.
    const entries = [
      ...[1, 2, 3, 4].map((h) => hole(h, 'A')),
      ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((h) => hole(h, 'H')),
    ]
    const computed = teamMatchGame.compute(ctx(), entries)
    const s = computed.extra?.match as MatchState
    expect(s.decided).toBe(true)
    expect(s.winner).toBe('A')
    expect(s.status).toBe('4 & 3')
    expect(computed.closedOut).toBe(true)
  })
})

describe('Team Match Play — dormie', () => {
  it('flags dormie when the lead equals the holes left', () => {
    // Green 3 up after 15 holes: three to play.
    const entries = [
      ...[1, 2, 3].map((h) => hole(h, 'A')),
      ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((h) => hole(h, 'H')),
    ]
    const s = state(ctx(), entries)
    expect(s.dormie).toBe(true)
    expect(s.decided).toBe(false)
  })
})

describe('Team Match Play — the end of the round', () => {
  const halvedRound = Array.from({ length: 18 }, (_, i) => hole(i + 1, 'H'))

  it('halves a match that is level after 18', () => {
    const s = state(ctx(), halvedRound)
    expect(s.winner).toBeNull()
    expect(s.decided).toBe(true)
    expect(teamMatchGame.finalResult(ctx(), halvedRound).headline).toBe('Match halved')
  })

  it('goes to sudden death when that is the chosen rule', () => {
    const s = state(ctx({ extraHoles: 'sudden' }), halvedRound)
    expect(s.suddenDeath).toBe(true)
    expect(s.decided).toBe(false)
  })

  it('pays the match to the winning pair', () => {
    const entries = [
      ...[1, 2].map((h) => hole(h, 'A')),
      ...Array.from({ length: 16 }, (_, i) => hole(i + 3, 'H')),
    ]
    // The board ranks on holes up, so the points are read from the hole outcomes.
    const t = pointsWon(teamMatchGame.compute(ctx({ matchValue: 5 }), entries).outcomes)
    expect(t[marc]).toBe(5)
    expect(t[phil]).toBe(5)
    expect(t[mike]).toBe(0)
    expect(t[john]).toBe(0)
  })
})

describe('Team Match Play — options', () => {
  it('scores net when handicaps are on', () => {
    const netPlayers = makePlayers(['Marc', 'Phil', 'Mike', 'John'], [18, 18, 0, 0])
    const ids = netPlayers.map((p) => p.id)
    const c = makeCtx(teamMatchGame, netPlayers, {
      scoring: 'net',
      handicapEnabled: true,
      handicapAllowance: 100,
      handicapMode: 'difference',
    })
    // Gross 5 v 4, but Marc has a shot on every hole so it is a halve.
    const s = state(c, [entry(1, netPlayers, [5, 6, 4, 6])])
    expect(s.diff).toBe(0)
    expect(ids).toHaveLength(4)
  })

  it('takes one score per team in foursomes', () => {
    // Only the first player of each team carries a score in alternate shot.
    const c = ctx({ format: 'foursomes' })
    const e = entry(1, players, [4, null, 5, null])
    const s = state(c, [e])
    expect(s.diff).toBe(1)
  })

  it('carries a halved hole when set to', () => {
    const c = ctx({ ties: 'carry' })
    const s = state(c, [hole(1, 'H'), hole(2, 'A')])
    // The halved hole doubles the second one.
    expect(s.diff).toBe(2)
  })

  it('honours a conceded hole', () => {
    const conceded: HoleEntry = { ...hole(1, 'H'), game: { conceded: 'B' } }
    const s = state(ctx(), [conceded])
    expect(s.diff).toBe(1)
  })

  it('rotates partners every six holes when asked', () => {
    const c = ctx({ teamRotation: 'six' })
    expect(teamsForHole(c, 1)).toEqual([[marc, phil], [mike, john]])
    expect(teamsForHole(c, 7)).toEqual([[marc, mike], [phil, john]])
    expect(teamsForHole(c, 13)).toEqual([[marc, john], [phil, mike]])
  })

  it('needs exactly four players', () => {
    expect(teamMatchGame.validatePlayers(3)).toBeTruthy()
    expect(teamMatchGame.validatePlayers(4)).toBeNull()
  })
})
