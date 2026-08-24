import { describe, expect, it } from 'vitest'
import { dotsGame } from './index'
import { DEFAULT_DOTS, parseDots, serializeDots } from './dotTypes'
import { entry, makeCtx, makePlayers, totals } from '../testUtils'
import { defaultCourse } from '../../core/course'

const players = makePlayers(['Marc', 'Phil', 'Mike', 'John'])
const [marc, phil, mike, john] = players.map((p) => p.id)

const course = defaultCourse()
const PAR4 = course.holes.find((h) => h.par === 4)!.number // hole 1
const PAR3 = course.holes.find((h) => h.par === 3)!.number // hole 3
const PAR5 = course.holes.find((h) => h.par === 5)!.number // hole 4

const ctx = (settings: Record<string, any> = {}) => makeCtx(dotsGame, players, settings)

/** Marc taps `dots`; everyone else taps nothing. */
const dotsFor = (map: Record<string, string[]>) => ({ dots: map })

describe('Dots — automatic dots', () => {
  it('counts a birdie from the score alone', () => {
    const t = totals(dotsGame.compute(ctx(), [entry(PAR4, players, [3, 4, 4, 4])]).standings)
    expect(t[marc]).toBe(1)
    expect(t[phil]).toBe(0)
  })

  it('counts an eagle and does not also pay the birdie', () => {
    const t = totals(dotsGame.compute(ctx(), [entry(PAR5, players, [3, 5, 5, 5])]).standings)
    expect(t[marc]).toBe(2)
  })

  it('ignores a disabled automatic dot', () => {
    const noBirdies = serializeDots(DEFAULT_DOTS.map((d) => (d.id === 'birdie' ? { ...d, enabled: false } : d)))
    const t = totals(dotsGame.compute(ctx({ dots: noBirdies }), [entry(PAR4, players, [3, 4, 4, 4])]).standings)
    expect(t[marc]).toBe(0)
  })

  it('can switch on the negative double-bogey dot', () => {
    const withDisaster = serializeDots(
      DEFAULT_DOTS.map((d) => (d.id === 'disaster' ? { ...d, enabled: true } : d)),
    )
    const t = totals(dotsGame.compute(ctx({ dots: withDisaster }), [entry(PAR4, players, [6, 4, 4, 4])]).standings)
    expect(t[marc]).toBe(-1)
  })
})

describe('Dots — tapped dots', () => {
  it('adds several dots on one hole for one player', () => {
    const e = entry(PAR3, players, [2, 3, 3, 3], dotsFor({ [marc]: ['greenie', 'chipin'] }))
    const t = totals(dotsGame.compute(ctx(), [e]).standings)
    // Birdie (auto) + greenie + chip-in.
    expect(t[marc]).toBe(3)
  })

  it('handles positive and negative dots on the same hole', () => {
    const e = entry(PAR4, players, [3, 4, 5, 4], dotsFor({ [phil]: ['sandy'], [mike]: ['snake'] }))
    const t = totals(dotsGame.compute(ctx(), [e]).standings)
    expect(t[marc]).toBe(1) // birdie
    expect(t[phil]).toBe(1) // sandy, par
    expect(t[mike]).toBe(-1) // three-putt
    expect(t[john]).toBe(0)
  })

  it('uses a custom dot with a custom value', () => {
    const custom = serializeDots([
      ...DEFAULT_DOTS,
      {
        id: 'custom_ferret',
        name: 'Ferret',
        emoji: '🦡',
        points: 3,
        auto: null,
        enabled: true,
        description: 'Holed from off the green without a putt.',
        custom: true,
      },
    ])
    const e = entry(PAR4, players, [4, 4, 4, 4], dotsFor({ [john]: ['custom_ferret'] }))
    expect(totals(dotsGame.compute(ctx({ dots: custom }), [e]).standings)[john]).toBe(3)
  })

  it('respects an edited point value', () => {
    const richBirdies = serializeDots(DEFAULT_DOTS.map((d) => (d.id === 'birdie' ? { ...d, points: 4 } : d)))
    const t = totals(dotsGame.compute(ctx({ dots: richBirdies }), [entry(PAR4, players, [3, 4, 4, 4])]).standings)
    expect(t[marc]).toBe(4)
  })
})

describe('Dots — greenie rules', () => {
  it('pays a greenie on a par 3 with par or better', () => {
    const e = entry(PAR3, players, [3, 4, 4, 4], dotsFor({ [marc]: ['greenie'] }))
    expect(totals(dotsGame.compute(ctx(), [e]).standings)[marc]).toBe(1)
  })

  it('voids a greenie when the player fails to make par', () => {
    const e = entry(PAR3, players, [5, 4, 4, 4], dotsFor({ [marc]: ['greenie'] }))
    const computed = dotsGame.compute(ctx(), [e])
    expect(totals(computed.standings)[marc]).toBe(0)
    expect(computed.outcomes[0].detail?.join(' ')).toContain('par or better')
  })

  it('pays regardless of score when the requirement is switched off', () => {
    const e = entry(PAR3, players, [5, 4, 4, 4], dotsFor({ [marc]: ['greenie'] }))
    expect(totals(dotsGame.compute(ctx({ greenieRequirement: 'none' }), [e]).standings)[marc]).toBe(1)
  })

  it('voids a greenie on a par 4 unless greenies count everywhere', () => {
    const e = entry(PAR4, players, [4, 4, 4, 4], dotsFor({ [marc]: ['greenie'] }))
    expect(totals(dotsGame.compute(ctx(), [e]).standings)[marc]).toBe(0)
    expect(totals(dotsGame.compute(ctx({ greenieScope: 'all' }), [e]).standings)[marc]).toBe(1)
  })
})

describe('Dots — sandy rules', () => {
  it('needs par or better by default', () => {
    const bogey = entry(PAR4, players, [5, 4, 4, 4], dotsFor({ [marc]: ['sandy'] }))
    expect(totals(dotsGame.compute(ctx(), [bogey]).standings)[marc]).toBe(0)
  })

  it('pays for any up and down when set that way', () => {
    const bogey = entry(PAR4, players, [5, 4, 4, 4], dotsFor({ [marc]: ['sandy'] }))
    expect(totals(dotsGame.compute(ctx({ sandyRequirement: 'updown' }), [bogey]).standings)[marc]).toBe(1)
  })
})

describe('Dots — snake', () => {
  it('charges every three-putt by default', () => {
    const entries = [
      entry(PAR4, players, [4, 4, 4, 4], dotsFor({ [mike]: ['snake'] })),
      entry(PAR5, players, [5, 5, 5, 5], dotsFor({ [mike]: ['snake'] })),
    ]
    expect(totals(dotsGame.compute(ctx(), entries).standings)[mike]).toBe(-2)
  })

  it('charges only the last three-putter in holder mode', () => {
    const entries = [
      entry(1, players, [4, 4, 4, 4], dotsFor({ [mike]: ['snake'] })),
      entry(2, players, [4, 4, 4, 4], dotsFor({ [john]: ['snake'] })),
    ]
    const computed = dotsGame.compute(ctx({ snakeMode: 'holder' }), entries)
    const t = totals(computed.standings)
    expect(t[mike]).toBe(0)
    expect(t[john]).toBe(-1)
    expect(computed.extra?.snakeHolder?.playerId).toBe(john)
  })

  it('shows who is holding the snake', () => {
    const entries = [entry(1, players, [4, 4, 4, 4], dotsFor({ [mike]: ['snake'] }))]
    const computed = dotsGame.compute(ctx({ snakeMode: 'holder' }), entries)
    expect(computed.status.find((s) => s.label === 'Snake')?.value).toBe('Mike')
  })
})

describe('Dots — editing', () => {
  it('recomputes when a hole is edited', () => {
    const before = [entry(PAR4, players, [3, 4, 4, 4], dotsFor({ [marc]: ['chipin'] }))]
    expect(totals(dotsGame.compute(ctx(), before).standings)[marc]).toBe(2)

    // The chip-in was tapped by mistake and removed.
    const after = [entry(PAR4, players, [3, 4, 4, 4], dotsFor({ [marc]: [] }))]
    expect(totals(dotsGame.compute(ctx(), after).standings)[marc]).toBe(1)
  })
})

describe('Dots — the dot list itself', () => {
  it('falls back to the defaults for bad or missing data', () => {
    expect(parseDots(undefined)).toHaveLength(DEFAULT_DOTS.length)
    expect(parseDots('not json')).toHaveLength(DEFAULT_DOTS.length)
  })

  it('round-trips through serialisation', () => {
    const custom = DEFAULT_DOTS.map((d) => ({ ...d, points: d.points * 2 }))
    expect(parseDots(serializeDots(custom))[0].points).toBe(DEFAULT_DOTS[0].points * 2)
  })
})
