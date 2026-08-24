import { describe, expect, it } from 'vitest'
import { calcHole, pairingForBlock, teamsForHole, vegasGame, vegasNumber } from './index'
import { entry, makeCtx, makePlayers, totals } from '../testUtils'

const players = makePlayers(['Marc', 'Phil', 'Mike', 'John'])
const [marc, phil, mike, john] = players.map((p) => p.id)
const ctx = (settings: Record<string, any> = {}) => makeCtx(vegasGame, players, settings)

describe('Vegas — building the number', () => {
  it('puts the scores side by side, lowest first', () => {
    expect(vegasNumber(4, 5)).toBe(45)
    expect(vegasNumber(5, 4)).toBe(45)
    expect(vegasNumber(3, 6)).toBe(36)
  })

  it('does not add the scores together', () => {
    expect(vegasNumber(4, 5)).not.toBe(9)
  })

  it('flips to put the higher score first', () => {
    expect(vegasNumber(5, 6, true)).toBe(65)
    expect(vegasNumber(4, 5, true)).toBe(54)
  })

  it('handles a score of ten or more', () => {
    expect(vegasNumber(4, 10)).toBe(410)
  })
})

describe('Vegas — scoring a hole', () => {
  it('pays the difference between the two team numbers', () => {
    // Marc 4 + Phil 5 = 45. Mike 3 + John 6 = 36. Difference 9.
    const c = ctx()
    const calc = calcHole(c, entry(7, players, [4, 5, 3, 6]))!
    expect(calc.numbers).toEqual([45, 36])
    expect(calc.diff).toBe(9)
    expect(calc.winner).toBe(1)
    expect(calc.points).toBe(9)

    const t = totals(vegasGame.compute(c, [entry(7, players, [4, 5, 3, 6])]).standings)
    expect(t[mike]).toBe(9)
    expect(t[john]).toBe(9)
    expect(t[marc]).toBe(-9)
    expect(t[phil]).toBe(-9)
  })

  it('multiplies by the configured amount', () => {
    const c = ctx({ pointMultiplier: 2 })
    const t = totals(vegasGame.compute(c, [entry(7, players, [4, 5, 3, 6])]).standings)
    expect(t[mike]).toBe(18)
    expect(t[marc]).toBe(-18)
  })

  it('scores nothing when both teams make the same number', () => {
    const c = ctx()
    const calc = calcHole(c, entry(1, players, [4, 5, 4, 5]))!
    expect(calc.diff).toBe(0)
    expect(calc.winner).toBeNull()
    const t = totals(vegasGame.compute(c, [entry(1, players, [4, 5, 4, 5])]).standings)
    expect(Object.values(t).every((v) => v === 0)).toBe(true)
  })

  it('caps the damage when a cap is set', () => {
    const c = ctx({ maxLossMode: 'cap', maxLoss: 20 })
    // 4+5 = 45 against 8+9 = 89. Raw difference 44, capped at 20.
    const calc = calcHole(c, entry(1, players, [4, 5, 8, 9]))!
    expect(calc.diff).toBe(44)
    expect(calc.points).toBe(20)
  })

  it('leaves a blow-up hole uncapped by default', () => {
    const calc = calcHole(ctx(), entry(1, players, [4, 5, 8, 9]))!
    expect(calc.points).toBe(44)
  })
})

describe('Vegas — the flip', () => {
  const par4Hole = 1 // the default card has a par 4 first hole

  it('does not flip when the rule is off', () => {
    const calc = calcHole(ctx({ flipRule: 'off' }), entry(par4Hole, players, [3, 5, 5, 6]))!
    expect(calc.flipped).toEqual([false, false])
    expect(calc.numbers).toEqual([35, 56])
  })

  it('flips the opposing team when a birdie is made', () => {
    // Marc birdies the par 4. Team B's 5 and 6 becomes 65 instead of 56.
    const calc = calcHole(ctx({ flipRule: 'birdie' }), entry(par4Hole, players, [3, 5, 5, 6]))!
    expect(calc.flipped[1]).toBe(true)
    expect(calc.numbers[1]).toBe(65)
    expect(calc.diff).toBe(30)
    expect(calc.winner).toBe(0)
  })

  it('only flips on a natural birdie when that variation is chosen', () => {
    const netPlayers = makePlayers(['Marc', 'Phil', 'Mike', 'John'], [18, 0, 0, 0])
    const c = makeCtx(vegasGame, netPlayers, {
      flipRule: 'naturalBirdie',
      scoring: 'net',
      handicapEnabled: true,
      handicapMode: 'difference',
    })
    // Marc's gross 4 on a par 4 becomes a net 3 — a birdie, but not a natural one.
    const calc = calcHole(c, entry(par4Hole, netPlayers, [4, 5, 5, 6]))!
    expect(calc.flipped[1]).toBe(false)
  })

  it('only flips for an eagle when set to eagle', () => {
    const c = ctx({ flipRule: 'eagle' })
    expect(calcHole(c, entry(par4Hole, players, [3, 5, 5, 6]))!.flipped[1]).toBe(false)
    expect(calcHole(c, entry(par4Hole, players, [2, 5, 5, 6]))!.flipped[1]).toBe(true)
  })
})

describe('Vegas — bonuses', () => {
  it('adds a birdie bonus on top of the difference', () => {
    const c = ctx({ birdieBonus: true, birdieBonusPoints: 5 })
    const t = totals(vegasGame.compute(c, [entry(1, players, [3, 5, 5, 6])]).standings)
    // Difference 35 v 56 is 21, plus a 5-point birdie bonus for team A.
    expect(t[marc]).toBe(26)
    expect(t[mike]).toBe(-26)
  })
})

describe('Vegas — net scoring', () => {
  it('builds the number from net scores', () => {
    const netPlayers = makePlayers(['Marc', 'Phil', 'Mike', 'John'], [18, 0, 0, 0])
    const c = makeCtx(vegasGame, netPlayers, {
      scoring: 'net',
      handicapEnabled: true,
      handicapMode: 'difference',
    })
    // Marc gets a shot: gross 5 plays as 4, so team A is 45 not 55.
    const calc = calcHole(c, entry(1, netPlayers, [5, 5, 4, 6]))!
    expect(calc.numbers[0]).toBe(45)
    expect(calc.numbers[1]).toBe(46)
  })
})

describe('Vegas — teams', () => {
  it('keeps the pairs fixed by default', () => {
    const c = ctx()
    expect(teamsForHole(c, 1)).toEqual([[marc, phil], [mike, john]])
    expect(teamsForHole(c, 13)).toEqual([[marc, phil], [mike, john]])
  })

  it('rotates partners every six holes when asked', () => {
    const c = ctx({ teamRotation: 'six' })
    expect(teamsForHole(c, 1)).toEqual([[marc, phil], [mike, john]])
    expect(teamsForHole(c, 7)).toEqual([[marc, mike], [phil, john]])
    expect(teamsForHole(c, 13)).toEqual([[marc, john], [phil, mike]])
  })

  it('covers all three possible pairings', () => {
    const ids = [marc, phil, mike, john]
    expect(pairingForBlock(ids, 0)).toEqual([[marc, phil], [mike, john]])
    expect(pairingForBlock(ids, 1)).toEqual([[marc, mike], [phil, john]])
    expect(pairingForBlock(ids, 2)).toEqual([[marc, john], [phil, mike]])
  })

  it('requires exactly four players', () => {
    expect(vegasGame.validatePlayers(3)).toBeTruthy()
    expect(vegasGame.validatePlayers(4)).toBeNull()
  })
})
