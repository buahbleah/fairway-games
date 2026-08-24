import { describe, expect, it } from 'vitest'
import { buildMatchLines, buildMatchups, nassauGame, type MatchLine } from './index'
import { entry, makeCtx, makePlayers, totals } from '../testUtils'
import type { GameContext, HoleEntry } from '../../core/types'

const two = makePlayers(['Marc', 'Phil'])
const [marc, phil] = two.map((p) => p.id)
const four = makePlayers(['Marc', 'Phil', 'Mike', 'John'])

const ctx = (settings: Record<string, any> = {}, players = two) =>
  makeCtx(nassauGame, players, { playType: 'individual', ...settings })

/** Marc wins `wins` holes, Phil wins `losses`, the rest are halved. */
function holes(range: number[], winner: 'A' | 'B' | 'H'): HoleEntry[] {
  return range.map((h) =>
    entry(h, two, winner === 'A' ? [4, 5] : winner === 'B' ? [5, 4] : [4, 4]),
  )
}

function lineFor(c: GameContext, entries: HoleEntry[], label: string): MatchLine {
  const matchup = buildMatchups(two, c.settings, c.gameState)[0]
  const lines = buildMatchLines(c, matchup, entries)
  return lines.find((l) => l.label === label)!
}

describe('Nassau — the three matches', () => {
  it('awards the front nine to the player who wins more of holes 1–9', () => {
    const c = ctx()
    const entries = [...holes([1, 2, 3], 'A'), ...holes([4, 5, 6, 7, 8, 9], 'H')]
    const front = lineFor(c, entries, 'Front 9')
    expect(front.diff).toBe(3)
    expect(front.decided).toBe(true)
    expect(front.winner).toBe('A')
    expect(totals(nassauGame.compute(c, entries).standings)[marc]).toBe(1)
  })

  it('runs the back nine as its own match', () => {
    const c = ctx()
    const entries = [...holes([10, 11], 'B'), ...holes([12, 13, 14, 15, 16, 17, 18], 'H')]
    const back = lineFor(c, entries, 'Back 9')
    expect(back.winner).toBe('B')
    expect(totals(nassauGame.compute(c, entries).standings)[phil]).toBe(1)
  })

  it('lets a player lose the front, win the back and take the overall', () => {
    const c = ctx()
    const entries = [
      ...holes([1, 2], 'B'), // Phil 2 up on the front
      ...holes([3, 4, 5, 6, 7, 8, 9], 'H'),
      ...holes([10, 11, 12], 'A'), // Marc wins the back
      ...holes([13, 14, 15, 16, 17, 18], 'H'),
    ]
    const computed = nassauGame.compute(c, entries)
    const t = totals(computed.standings)
    expect(lineFor(c, entries, 'Front 9').winner).toBe('B')
    expect(lineFor(c, entries, 'Back 9').winner).toBe('A')
    expect(lineFor(c, entries, 'Overall').winner).toBe('A')
    expect(t[marc]).toBe(2)
    expect(t[phil]).toBe(1)
  })

  it('halves a component nobody won', () => {
    const c = ctx()
    const entries = holes([1, 2, 3, 4, 5, 6, 7, 8, 9], 'H')
    const front = lineFor(c, entries, 'Front 9')
    expect(front.decided).toBe(true)
    expect(front.winner).toBeNull()
    expect(front.status).toBe('Halved')
    expect(totals(nassauGame.compute(c, entries).standings)[marc]).toBe(0)
  })

  it('honours separate values for each component', () => {
    const c = ctx({ frontValue: 5, backValue: 5, overallValue: 10 })
    const entries = [
      ...holes([1, 2], 'A'),
      ...holes([3, 4, 5, 6, 7, 8, 9], 'H'),
      ...holes([10, 11, 12, 13, 14, 15, 16, 17, 18], 'H'),
    ]
    // Marc wins the front (5) and the overall (10); the back is halved.
    expect(totals(nassauGame.compute(c, entries).standings)[marc]).toBe(15)
  })
})

describe('Nassau — match status wording', () => {
  it('reads AS, 1 UP and closes out with the & notation', () => {
    const c = ctx()
    expect(lineFor(c, holes([1], 'H'), 'Front 9').status).toBe('AS')
    expect(lineFor(c, holes([1], 'A'), 'Front 9').status).toBe('1 UP')
    const closed = lineFor(c, [...holes([1, 2, 3], 'A'), ...holes([4, 5, 6, 7], 'H')], 'Front 9')
    expect(closed.status).toBe('3 & 2')
  })

  it('flags dormie', () => {
    const c = ctx()
    // 2 up with 2 to play on the front nine.
    const entries = [...holes([1, 2], 'A'), ...holes([3, 4, 5, 6, 7], 'H')]
    expect(lineFor(c, entries, 'Front 9').status).toContain('DORMIE')
  })
})

describe('Nassau — presses', () => {
  it('does not press when presses are switched off', () => {
    const c = ctx({ pressesEnabled: false })
    const entries = holes([1, 2], 'A')
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    expect(buildMatchLines(c, matchup, entries).filter((l) => l.isPress)).toHaveLength(0)
  })

  it('opens an automatic press the moment a side is 2 down', () => {
    const c = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 2 })
    const entries = holes([1, 2], 'A')
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    const presses = buildMatchLines(c, matchup, entries).filter((l) => l.isPress)
    expect(presses).toHaveLength(1)
    expect(presses[0].startHole).toBe(3)
    expect(presses[0].endHole).toBe(9)
  })

  it('respects a different press trigger', () => {
    const c = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 1 })
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    const presses = buildMatchLines(c, matchup, holes([1], 'A')).filter((l) => l.isPress)
    expect(presses[0].startHole).toBe(2)
  })

  it('pays out a won press on top of the original bet', () => {
    const c = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 2 })
    const entries = [
      ...holes([1, 2], 'A'), // Marc 2 up, press opens on hole 3
      ...holes([3, 4], 'A'), // Marc wins the press too
      ...holes([5, 6, 7, 8, 9], 'H'),
    ]
    const t = totals(nassauGame.compute(c, entries).standings)
    // Front nine (1) + the press (1). The back and overall are still running.
    expect(t[marc]).toBe(2)
  })

  it('keeps several presses alive at once', () => {
    const c = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 2, rePress: true })
    const entries = [...holes([1, 2], 'A'), ...holes([3, 4], 'A')]
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    const presses = buildMatchLines(c, matchup, entries).filter((l) => l.isPress)
    // The front-nine press opened on 3; it went 2 down by hole 4, so it re-pressed.
    expect(presses.length).toBeGreaterThanOrEqual(2)
  })

  it('does not re-press when re-presses are off', () => {
    const c = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 2, rePress: false })
    const entries = [...holes([1, 2], 'A'), ...holes([3, 4], 'A')]
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    const presses = buildMatchLines(c, matchup, entries).filter((l) => l.isPress)
    expect(presses).toHaveLength(1)
  })

  it('accepts a manual press', () => {
    const c = makeCtx(
      nassauGame,
      two,
      { playType: 'individual', pressesEnabled: true, autoPress: false },
      { presses: [{ id: 'press_manual', matchupId: `m_${marc}_${phil}`, segment: 'front', startHole: 4, by: 'B', auto: false, parentId: '' }] },
    )
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    const presses = buildMatchLines(c, matchup, holes([1, 2, 3], 'A')).filter((l) => l.isPress)
    expect(presses).toHaveLength(1)
    expect(presses[0].startHole).toBe(4)
  })

  it('leaves the overall match unpressed unless asked', () => {
    const c = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 2 })
    const matchup = buildMatchups(two, c.settings, c.gameState)[0]
    const lines = buildMatchLines(c, matchup, holes([1, 2], 'A'))
    expect(lines.filter((l) => l.isPress && l.segment === 'overall')).toHaveLength(0)

    const c2 = ctx({ pressesEnabled: true, autoPress: true, pressTrigger: 2, pressOverall: true })
    const lines2 = buildMatchLines(c2, matchup, holes([1, 2], 'A'))
    expect(lines2.filter((l) => l.isPress && l.segment === 'overall')).toHaveLength(1)
  })
})

describe('Nassau — teams and round robin', () => {
  it('plays four golfers as two pairs when asked', () => {
    const c = makeCtx(nassauGame, four, { playType: 'teams' })
    const matchups = buildMatchups(four, c.settings, c.gameState)
    expect(matchups).toHaveLength(1)
    expect(matchups[0].sideA).toHaveLength(2)

    // Team A better ball 4 v team B better ball 5.
    const entries = [
      ...[1, 2].map((h) => entry(h, four, [4, 7, 5, 5])),
      ...[3, 4, 5, 6, 7, 8, 9].map((h) => entry(h, four, [4, 4, 4, 4])),
    ]
    const t = totals(nassauGame.compute(c, entries).standings)
    expect(t[four[0].id]).toBe(1)
    expect(t[four[1].id]).toBe(1)
    expect(t[four[2].id]).toBe(0)
  })

  it('gives every pair their own Nassau in individual play', () => {
    const c = makeCtx(nassauGame, four, { playType: 'individual' })
    expect(buildMatchups(four, c.settings, c.gameState)).toHaveLength(6)
  })

  it('picks teams automatically for four and singles for two', () => {
    const cFour = makeCtx(nassauGame, four, { playType: 'auto' })
    expect(buildMatchups(four, cFour.settings, cFour.gameState)).toHaveLength(1)
    const cTwo = makeCtx(nassauGame, two, { playType: 'auto' })
    expect(buildMatchups(two, cTwo.settings, cTwo.gameState)).toHaveLength(1)
  })
})
