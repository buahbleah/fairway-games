import { describe, expect, it } from 'vitest'
import { holeSkinValue, skinsGame } from './index'
import { entry, makeCtx, makePlayers, totals } from '../testUtils'

const players = makePlayers(['Marc', 'Phil', 'Mike', 'John'])
const [marc, phil, mike, john] = players.map((p) => p.id)
const ctx = (settings: Record<string, any> = {}) => makeCtx(skinsGame, players, settings)

describe('Skins — a clear winner', () => {
  it('gives the hole to the single lowest score', () => {
    const t = totals(skinsGame.compute(ctx(), [entry(1, players, [4, 5, 5, 6])]).standings)
    expect(t[marc]).toBe(1)
    expect(t[phil]).toBe(0)
    expect(t[mike]).toBe(0)
    expect(t[john]).toBe(0)
  })

  it('multiplies by the configured skin value', () => {
    const t = totals(skinsGame.compute(ctx({ skinValue: 5 }), [entry(1, players, [4, 5, 5, 6])]).standings)
    expect(t[marc]).toBe(5)
  })
})

describe('Skins — ties and carries', () => {
  it('gives nobody the hole when the best score is tied', () => {
    const c = skinsGame.compute(ctx(), [entry(1, players, [4, 4, 5, 6])])
    expect(Object.values(totals(c.standings)).every((v) => v === 0)).toBe(true)
    expect(c.outcomes[0].headline).toContain('carry')
  })

  it('carries a tied skin into the next hole', () => {
    const c = ctx()
    const result = skinsGame.compute(c, [
      entry(1, players, [4, 4, 5, 6]),
      entry(2, players, [5, 5, 4, 6]),
    ])
    expect(totals(result.standings)[mike]).toBe(2)
  })

  it('stacks multiple carries', () => {
    // Three tied holes then a winner: 4 skins in one go.
    const result = skinsGame.compute(ctx(), [
      entry(1, players, [4, 4, 5, 6]),
      entry(2, players, [4, 4, 5, 6]),
      entry(3, players, [4, 4, 5, 6]),
      entry(4, players, [5, 6, 4, 6]),
    ])
    expect(totals(result.standings)[mike]).toBe(4)
  })

  it('can be set to split a tied skin instead', () => {
    const t = totals(skinsGame.compute(ctx({ carryRule: 'split' }), [entry(1, players, [4, 4, 5, 6])]).standings)
    expect(t[marc]).toBe(0.5)
    expect(t[phil]).toBe(0.5)
  })

  it('can be set not to carry at all', () => {
    const result = skinsGame.compute(ctx({ carryRule: 'none' }), [
      entry(1, players, [4, 4, 5, 6]),
      entry(2, players, [5, 5, 4, 6]),
    ])
    expect(totals(result.standings)[mike]).toBe(1)
  })
})

describe('Skins — progressive and custom hole values', () => {
  it('scales the pot by hole number', () => {
    const s = { progressive: true, progressiveTier2: 2, progressiveTier3: 3, progressiveTier4: 5 }
    expect(holeSkinValue(s, 3)).toBe(1)
    expect(holeSkinValue(s, 8)).toBe(2)
    expect(holeSkinValue(s, 15)).toBe(3)
    expect(holeSkinValue(s, 18)).toBe(5)
  })

  it('lets a single hole be given its own value', () => {
    const s = { customHoleValues: { '18': 5 } }
    expect(holeSkinValue(s, 18)).toBe(5)
    expect(holeSkinValue(s, 17)).toBe(1)
  })

  it('pays a progressive hole correctly', () => {
    const c = ctx({ progressive: true, progressiveTier2: 2 })
    const t = totals(skinsGame.compute(c, [entry(8, players, [4, 5, 5, 6])]).standings)
    expect(t[marc]).toBe(2)
  })
})

describe('Skins — validation', () => {
  it('holds a skin until the winner ties or wins the next hole', () => {
    const c = ctx({ validation: true })
    // Marc wins hole 1, then ties hole 2 for lowest -> validated.
    const validated = skinsGame.compute(c, [
      entry(1, players, [4, 5, 5, 6]),
      entry(2, players, [4, 4, 5, 6]),
    ])
    expect(totals(validated.standings)[marc]).toBe(1)
  })

  it('returns an unvalidated skin to the pot', () => {
    const c = ctx({ validation: true })
    // Marc wins hole 1 but is nowhere on hole 2, which Mike wins outright.
    const result = skinsGame.compute(c, [
      entry(1, players, [4, 5, 5, 6]),
      entry(2, players, [6, 5, 4, 6]),
    ])
    const t = totals(result.standings)
    expect(t[marc]).toBe(0)
    // Mike takes hole 2 plus the skin Marc could not validate.
    expect(t[mike]).toBe(2)
  })

  it('does not require validation on the final hole', () => {
    const c = ctx({ validation: true })
    const entries = [entry(18, players, [4, 5, 5, 6])]
    expect(totals(skinsGame.compute(c, entries).standings)[marc]).toBe(1)
  })
})

describe('Skins — final hole behaviour', () => {
  const tiedLast = [entry(17, players, [4, 4, 5, 6]), entry(18, players, [4, 4, 5, 6])]

  it('splits a tied final pot by default', () => {
    const t = totals(skinsGame.compute(ctx(), tiedLast).standings)
    expect(t[marc]).toBe(1)
    expect(t[phil]).toBe(1)
  })

  it('can void the pot instead', () => {
    const t = totals(skinsGame.compute(ctx({ finalHoleTie: 'void' }), tiedLast).standings)
    expect(t[marc]).toBe(0)
    expect(t[phil]).toBe(0)
  })

  it('can leave the pot for a play-off', () => {
    const c = skinsGame.compute(ctx({ finalHoleTie: 'playoff' }), tiedLast)
    expect(c.extra?.undecided).toBe(2)
  })
})

describe('Skins — net scoring', () => {
  it('lets a handicap shot win the hole', () => {
    const netPlayers = makePlayers(['Marc', 'Phil', 'Mike', 'John'], [18, 0, 0, 0])
    const ids = netPlayers.map((p) => p.id)
    const c = makeCtx(skinsGame, netPlayers, {
      scoring: 'net',
      handicapEnabled: true,
      handicapMode: 'difference',
    })
    // Gross: Marc 5, others 4/5/6 — a shot turns Marc's 5 into a 4 and wins.
    const t = totals(skinsGame.compute(c, [entry(1, netPlayers, [5, 6, 5, 6])]).standings)
    expect(t[ids[0]]).toBe(1)
  })
})

describe('Skins — the running pot', () => {
  it('reports what the next hole is worth', () => {
    const c = skinsGame.compute(ctx(), [entry(1, players, [4, 4, 5, 6])])
    expect(c.extra?.pot).toBe(2)
    expect(c.extra?.carried).toBe(1)
    expect(c.status.find((s) => s.label === 'Carried')?.value).toBe('1 hole')
  })

  it('names a winner in the final result', () => {
    const result = skinsGame.finalResult(ctx(), [entry(1, players, [4, 5, 5, 6])])
    expect(result.winners).toEqual([marc])
    expect(result.standings.find((s) => s.playerId === john)?.value).toBe(0)
  })
})
