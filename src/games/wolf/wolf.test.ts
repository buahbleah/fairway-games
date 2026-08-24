import { describe, expect, it } from 'vitest'
import { wolfForHole, wolfGame } from './index'
import { entry, makeCtx, makePlayers, totals } from '../testUtils'

const players = makePlayers(['Marc', 'Phil', 'Mike', 'John'])
const [marc, phil, mike, john] = players.map((p) => p.id)

const ctx = (settings: Record<string, any> = {}) => makeCtx(wolfGame, players, settings)

describe('Wolf — partner holes', () => {
  it('pays the wolf and the partner when their better ball wins', () => {
    const c = ctx()
    // Wolf team best ball 4, hunters best ball 5.
    const e = entry(1, players, [4, 6, 5, 5], { wolfId: marc, mode: 'partner', partnerId: phil })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[marc]).toBe(2)
    expect(t[phil]).toBe(2)
    expect(t[mike]).toBe(0)
    expect(t[john]).toBe(0)
  })

  it('pays each hunter when the wolf team loses', () => {
    const c = ctx()
    const e = entry(1, players, [5, 6, 4, 7], { wolfId: marc, mode: 'partner', partnerId: phil })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[marc]).toBe(0)
    expect(t[phil]).toBe(0)
    expect(t[mike]).toBe(3)
    expect(t[john]).toBe(3)
  })

  it('uses the better ball, not the wolf’s own score', () => {
    const c = ctx()
    // Wolf plays badly but the partner carries the team.
    const e = entry(1, players, [8, 3, 4, 4], { wolfId: marc, mode: 'partner', partnerId: phil })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[marc]).toBe(2)
    expect(t[phil]).toBe(2)
  })
})

describe('Wolf — lone and blind', () => {
  it('pays a winning Lone Wolf the full amount', () => {
    const c = ctx()
    const e = entry(1, players, [3, 4, 4, 4], { wolfId: marc, mode: 'lone' })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[marc]).toBe(3)
    expect(t[phil]).toBe(0)
  })

  it('pays every opponent when a Lone Wolf is beaten', () => {
    const c = ctx()
    const e = entry(1, players, [5, 4, 6, 6], { wolfId: marc, mode: 'lone' })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[marc]).toBe(0)
    expect(t[phil]).toBe(2)
    expect(t[mike]).toBe(2)
    expect(t[john]).toBe(2)
  })

  it('multiplies Blind Wolf points', () => {
    const c = ctx({ blindWolfMultiplier: 2 })
    const win = entry(1, players, [3, 4, 4, 4], { wolfId: marc, mode: 'blind' })
    expect(totals(wolfGame.compute(c, [win]).standings)[marc]).toBe(6)

    const loss = entry(2, players, [5, 4, 6, 6], { wolfId: marc, mode: 'blind' })
    const t = totals(wolfGame.compute(c, [loss]).standings)
    expect(t[phil]).toBe(4)
  })

  it('honours custom point values', () => {
    const c = ctx({ wolfTeamWinPoints: 5, hunterWinPoints: 7, loneWolfWinPoints: 9, loneWolfLossPoints: 4 })
    const partner = entry(1, players, [4, 6, 5, 5], { wolfId: marc, mode: 'partner', partnerId: phil })
    expect(totals(wolfGame.compute(c, [partner]).standings)[marc]).toBe(5)

    const lone = entry(2, players, [3, 4, 4, 4], { wolfId: marc, mode: 'lone' })
    expect(totals(wolfGame.compute(c, [lone]).standings)[marc]).toBe(9)
  })
})

describe('Wolf — tied holes', () => {
  const tiedHole = entry(1, players, [4, 5, 4, 6], { wolfId: marc, mode: 'partner', partnerId: phil })

  it('pays nobody by default', () => {
    const t = totals(wolfGame.compute(ctx({ tieBehaviour: 'push' }), [tiedHole]).standings)
    expect(Object.values(t).every((v) => v === 0)).toBe(true)
  })

  it('can give ties to the hunters', () => {
    const t = totals(wolfGame.compute(ctx({ tieBehaviour: 'hunters' }), [tiedHole]).standings)
    expect(t[mike]).toBe(3)
    expect(t[john]).toBe(3)
    expect(t[marc]).toBe(0)
  })

  it('can give ties to the wolf side', () => {
    const t = totals(wolfGame.compute(ctx({ tieBehaviour: 'wolf' }), [tiedHole]).standings)
    expect(t[marc]).toBe(2)
    expect(t[phil]).toBe(2)
  })

  it('carries the points into the next hole', () => {
    const c = ctx({ tieBehaviour: 'carry' })
    const next = entry(2, players, [4, 6, 5, 5], { wolfId: phil, mode: 'partner', partnerId: marc })
    const computed = wolfGame.compute(c, [tiedHole, next])
    const t = totals(computed.standings)
    // Hole 2 is worth double after the tie.
    expect(t[marc]).toBe(4)
    expect(t[phil]).toBe(4)
    expect(computed.outcomes[0].headline).toContain('carry')
  })

  it('caps a long run of carries', () => {
    const c = ctx({ tieBehaviour: 'carry', carryCap: 3 })
    const ties = [1, 2, 3, 4].map((h) =>
      entry(h, players, [4, 5, 4, 6], { wolfId: marc, mode: 'partner', partnerId: phil }),
    )
    const decider = entry(5, players, [4, 6, 5, 5], { wolfId: marc, mode: 'partner', partnerId: phil })
    const t = totals(wolfGame.compute(c, [...ties, decider]).standings)
    expect(t[marc]).toBe(2 * 3)
  })
})

describe('Wolf — net scoring', () => {
  it('applies handicap strokes on the right holes', () => {
    const netPlayers = makePlayers(['Marc', 'Phil', 'Mike', 'John'], [18, 0, 0, 0])
    const c = makeCtx(wolfGame, netPlayers, {
      scoring: 'net',
      handicapEnabled: true,
      handicapMode: 'difference',
      handicapAllowance: 100,
    })
    const ids = netPlayers.map((p) => p.id)
    // Marc receives a shot on every hole, so his gross 5 is a net 4 and wins.
    const e = entry(1, netPlayers, [5, 6, 4, 4], { wolfId: ids[0], mode: 'lone' })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[ids[0]]).toBe(0) // net 4 ties the field's 4 -> push by default

    const better = entry(2, netPlayers, [4, 6, 4, 4], { wolfId: ids[0], mode: 'lone' })
    expect(totals(wolfGame.compute(c, [better]).standings)[ids[0]]).toBe(3)
  })
})

describe('Wolf — rotation', () => {
  it('moves the wolf down the order', () => {
    const rotation = [marc, phil, mike, john]
    expect(wolfForHole(rotation, 0, { finalHoles: 'continue' }, [])).toBe(marc)
    expect(wolfForHole(rotation, 1, { finalHoles: 'continue' }, [])).toBe(phil)
    expect(wolfForHole(rotation, 4, { finalHoles: 'continue' }, [])).toBe(marc)
  })

  it('gives holes 17 and 18 to the player in last place when asked', () => {
    const rotation = [marc, phil, mike, john]
    const standings = [
      { playerId: marc, value: 10 },
      { playerId: phil, value: 2 },
      { playerId: mike, value: 6 },
      { playerId: john, value: 8 },
    ]
    expect(wolfForHole(rotation, 16, { finalHoles: 'trailing' }, standings)).toBe(phil)
    expect(wolfForHole(rotation, 16, { finalHoles: 'leader' }, standings)).toBe(marc)
    expect(wolfForHole(rotation, 16, { finalHoles: 'continue' }, standings)).toBe(marc)
  })
})

describe('Wolf — three players', () => {
  const three = makePlayers(['Marc', 'Phil', 'Mike'])
  it('scores a lone wolf against two opponents', () => {
    const c = makeCtx(wolfGame, three)
    const ids = three.map((p) => p.id)
    const e = entry(1, three, [3, 4, 5], { wolfId: ids[0], mode: 'lone' })
    const t = totals(wolfGame.compute(c, [e]).standings)
    expect(t[ids[0]]).toBe(3)
  })

  it('rejects two players and accepts three', () => {
    expect(wolfGame.validatePlayers(2)).toBeTruthy()
    expect(wolfGame.validatePlayers(3)).toBeNull()
    expect(wolfGame.validatePlayers(5)).toBeTruthy()
  })
})

describe('Wolf — round result', () => {
  it('names the leader and counts lone holes', () => {
    const c = ctx()
    const entries = [
      entry(1, players, [4, 6, 5, 5], { wolfId: marc, mode: 'partner', partnerId: phil }),
      entry(2, players, [4, 3, 4, 4], { wolfId: phil, mode: 'lone' }),
    ]
    const result = wolfGame.finalResult(c, entries)
    expect(result.winners).toContain(phil)
    expect(result.lines.join(' ')).toContain('1 Lone Wolf hole')
  })
})
