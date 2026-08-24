/**
 * DOTS  (also called Junk, Trash or Garbage)
 *
 * Points for the good bits of golf that a scorecard never records: a birdie,
 * a greenie, getting up and down out of sand, holing a chip. And a penalty for
 * the three-putt. Every group plays it differently, so every dot is editable.
 */

import { holeByNumber } from '../../core/course'
import {
  completedEntries,
  effectiveScores,
  nameOf,
  netContextFrom,
  rankRows,
  signed,
  sumPoints,
  tidy,
  toParTotal,
  withMovement,
} from '../../core/scoring'
import {
  choice,
  defaultsFrom,
  grossNetSetting,
  handicapSettings,
  moneyLabel,
  num,
  pointValueSetting,
} from '../../core/settings'
import type {
  ComputedRound,
  FinalResult,
  GameContext,
  GolfGame,
  HoleEntry,
  HoleOutcome,
  PlayerId,
  RulesDoc,
  SettingDef,
  SettingsValues,
  StatusChip,
} from '../../core/types'
import { DEFAULT_DOTS, parseDots, serializeDots, type DotDef } from './dotTypes'

const RULES = 'Dot rules'

export const dotsSettings: SettingDef[] = [
  {
    type: 'dotBuilder',
    key: 'dots',
    label: 'Active dots',
    group: 'Dots',
    default: serializeDots(DEFAULT_DOTS),
    help: 'Switch dots on or off, rename them, change what they are worth, or add your own.',
  },
  choice('greenieScope', 'Greenies count on', 'par3', [
    { value: 'par3', label: 'Par 3s only', help: 'The usual rule.' },
    { value: 'all', label: 'Every approach', help: 'Closest to the pin in regulation on any hole.' },
  ], { group: RULES }),
  choice('greenieRequirement', 'A greenie needs', 'par', [
    { value: 'par', label: 'Par or better', help: 'Hit it close and then finish the job.' },
    { value: 'none', label: 'No score requirement', help: 'Closest to the pin is enough.' },
  ], { group: RULES }),
  choice('sandyRequirement', 'A sandy needs', 'par', [
    { value: 'par', label: 'Par or better', help: 'Out of the sand and no worse than par.' },
    { value: 'updown', label: 'Up and down only', help: 'One shot out, one putt — whatever the score.' },
  ], { group: RULES }),
  choice('snakeMode', 'Snake', 'each', [
    { value: 'each', label: 'Every three-putt', help: 'Each three-putt costs its points there and then.' },
    { value: 'holder', label: 'Holder takes it', help: 'The last player to three-putt carries the snake and pays at the 18th.' },
  ], { group: RULES }),
  num('longPuttDistance', 'Long putt from', 10, {
    group: RULES, min: 3, max: 40, suffix: 'm', advanced: true,
    help: 'How far out a putt has to be to earn the Long Putt dot.',
  }),
  grossNetSetting(),
  ...handicapSettings(100, 'Dots is usually played off full handicap, or straight gross for simplicity.'),
  pointValueSetting(),
]

/* ----------------------------------------------------------------- payload */

/** entry.game.dots — which dots each player tapped on this hole. */
export type DotsHolePayload = Record<PlayerId, string[]>

function autoDotsFor(def: DotDef, strokes: number, par: number): boolean {
  const d = strokes - par
  switch (def.auto) {
    case 'birdie':
      return d === -1
    case 'eagle':
      return d === -2
    case 'albatross':
      return d <= -3
    case 'holeInOne':
      return strokes === 1
    case 'doubleBogey':
      return d >= 2
    default:
      return false
  }
}

/* ----------------------------------------------------------------- compute */

interface EarnedDot {
  playerId: PlayerId
  dot: DotDef
  points: number
  /** Set when the dot was tapped but the rules did not allow it. */
  voidedReason?: string
}

export function dotsOnHole(ctx: GameContext, entry: HoleEntry, dots: DotDef[]): EarnedDot[] {
  const net = netContextFrom(ctx)
  const scores = effectiveScores(ctx, net, entry)
  const par = holeByNumber(ctx.course, entry.hole).par
  const tapped = (entry.game?.dots ?? {}) as DotsHolePayload
  const out: EarnedDot[] = []

  for (const player of ctx.players) {
    const strokes = scores[player.id]
    const chosen = tapped[player.id] ?? []

    for (const dot of dots) {
      if (!dot.enabled) continue

      if (dot.auto) {
        if (strokes == null) continue
        // An eagle should not also pay a birdie: the better dot wins.
        if (dot.auto === 'birdie' && dots.some((d) => d.enabled && d.auto === 'eagle' && autoDotsFor(d, strokes, par))) continue
        if (autoDotsFor(dot, strokes, par)) out.push({ playerId: player.id, dot, points: dot.points })
        continue
      }

      if (!chosen.includes(dot.id)) continue

      // Rule checks for the dots whose definition varies between groups.
      if (dot.id === 'greenie') {
        if (ctx.settings.greenieScope === 'par3' && par !== 3) {
          out.push({ playerId: player.id, dot, points: 0, voidedReason: 'Greenies only count on par 3s' })
          continue
        }
        if (ctx.settings.greenieRequirement === 'par' && strokes != null && strokes > par) {
          out.push({ playerId: player.id, dot, points: 0, voidedReason: 'Greenie needs par or better' })
          continue
        }
      }
      if (dot.id === 'sandy' && ctx.settings.sandyRequirement === 'par' && strokes != null && strokes > par) {
        out.push({ playerId: player.id, dot, points: 0, voidedReason: 'Sandy needs par or better' })
        continue
      }

      out.push({ playerId: player.id, dot, points: dot.points })
    }
  }
  return out
}

function compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound {
  const dots = parseDots(ctx.settings.dots as string)
  const snakeDot = dots.find((d) => d.id === 'snake' && d.enabled)
  const holderMode = ctx.settings.snakeMode === 'holder' && !!snakeDot
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)

  const outcomes: HoleOutcome[] = []
  let snakeHolder: { playerId: PlayerId; hole: number } | null = null

  for (const e of done) {
    const points: Record<PlayerId, number> = Object.fromEntries(ctx.players.map((p) => [p.id, 0]))
    const earned = dotsOnHole(ctx, e, dots)
    const detail: string[] = []
    const bits: string[] = []

    for (const item of earned) {
      const isSnake = item.dot.id === 'snake'
      if (isSnake && holderMode) {
        snakeHolder = { playerId: item.playerId, hole: e.hole }
        detail.push(`${nameOf(ctx.players, item.playerId)} picks up the snake.`)
        continue
      }
      if (item.voidedReason) {
        detail.push(`${nameOf(ctx.players, item.playerId)} — ${item.dot.name} did not count: ${item.voidedReason}.`)
        continue
      }
      points[item.playerId] += item.points
      bits.push(`${nameOf(ctx.players, item.playerId)} ${item.dot.emoji} ${item.dot.name} ${signed(item.points)}`)
    }

    outcomes.push({
      hole: e.hole,
      points,
      headline: bits.length ? bits.join(' · ') : 'No dots on this hole',
      detail,
    })
  }

  // Holder-style snake: only the last three-putter pays, once, at the end.
  if (holderMode && snakeHolder && outcomes.length) {
    const last = outcomes[outcomes.length - 1]
    last.points[snakeHolder.playerId] = (last.points[snakeHolder.playerId] ?? 0) + snakeDot!.points
    last.detail = [
      ...(last.detail ?? []),
      `${nameOf(ctx.players, snakeHolder.playerId)} ends the round holding the snake · ${signed(snakeDot!.points)}`,
    ]
  }

  const totals = sumPoints(outcomes.map((o) => o.points), ctx.players)
  const pointValue = Number(ctx.settings.pointValue ?? 0)
  const strokeTotals = toParTotal(ctx, done)

  const standings = rankRows(
    ctx.players.map((p) => ({
      playerId: p.id,
      value: tidy(totals[p.id] ?? 0),
      display: signed(tidy(totals[p.id] ?? 0)),
      sub: [strokeTotals[p.id], moneyLabel(totals[p.id] ?? 0, pointValue)].filter(Boolean).join(' · ') || undefined,
    })),
    true,
  )
  const prevTotals = sumPoints(outcomes.slice(0, -1).map((o) => o.points), ctx.players)
  const previous = rankRows(
    ctx.players.map((p) => ({ playerId: p.id, value: prevTotals[p.id] ?? 0, display: '' })),
    true,
  )

  const status: StatusChip[] = []
  if (holderMode) {
    status.push({
      label: 'Snake',
      value: snakeHolder ? nameOf(ctx.players, snakeHolder.playerId) : 'Nobody yet',
      tone: snakeHolder ? 'bad' : 'neutral',
    })
  }

  return {
    outcomes,
    standings: withMovement(standings, previous),
    status,
    extra: { dots, snakeHolder },
  }
}

function explain(s: SettingsValues): RulesDoc {
  const dots = parseDots(s.dots as string).filter((d) => d.enabled)
  return {
    summary:
      'Dots — also called Junk, Trash or Garbage — pays points for the moments a scorecard misses. Birdies, greenies, sandies, chip-ins. And it takes points back for a three-putt.',
    sections: [
      {
        title: 'How it runs',
        body: [
          'Play your normal golf and enter your scores as usual.',
          'After the hole the app asks "anything extra?" — tap whatever anybody earned. It takes a few seconds.',
          'Birdies and eagles are picked up automatically from the score. You only tap the things the app cannot see.',
        ],
      },
      {
        title: 'The dots in play this round',
        body: dots.map((d) => `${d.emoji} ${d.name} ${signed(d.points)} — ${d.description}`),
      },
      {
        title: 'The rules your group chose',
        body: [
          s.greenieScope === 'par3' ? 'Greenies only count on par 3s.' : 'Greenies count on any approach hit in regulation.',
          s.greenieRequirement === 'par' ? 'A greenie needs par or better to pay.' : 'A greenie pays regardless of the score.',
          s.sandyRequirement === 'par' ? 'A sandy needs par or better.' : 'A sandy pays for any up and down from sand.',
          s.snakeMode === 'holder'
            ? 'Snake is played holder-style: whoever three-putted last is stuck with it at the 18th.'
            : 'Every three-putt costs the snake points there and then.',
        ],
      },
    ],
    example: {
      title: 'Hole 12, a par 3',
      rows: [
        { label: 'Marc — tee shot to 3 metres, holes the putt', value: 'Birdie +1, Greenie +1', emphasis: true },
        { label: 'Phil — bunker, splashes out, one putt', value: 'Sandy +1' },
        { label: 'Mike — on the green, three putts', value: 'Snake −1' },
        { label: 'John — par', value: 'Nothing' },
      ],
      result: 'Marc +2 · Phil +1 · Mike −1 · John 0',
    },
    variations: [
      { name: 'Names', text: 'The same game is called Junk, Trash or Garbage depending on who you ask.' },
      { name: 'Holder snake', text: 'Only the last three-putter pays, which keeps it alive all round.', active: s.snakeMode === 'holder' },
      { name: 'Greenies on every hole', text: 'Closest in regulation on any hole, not just par 3s.', active: s.greenieScope === 'all' },
      { name: 'Sandy without the score', text: 'Up and down from sand pays even for a bogey.', active: s.sandyRequirement === 'updown' },
      { name: 'Your own dots', text: 'Add anything your group plays for — every dot is editable.' },
    ],
    definitions: [
      { term: 'Greenie', text: 'Closest to the pin on a par 3, having found the green from the tee.' },
      { term: 'Sandy', text: 'Up and down from a bunker.' },
      { term: 'Snake', text: 'A three-putt.' },
      { term: 'Barkie', text: 'Hitting a tree and still making par.' },
      { term: 'Poley', text: 'Holing a putt from at least a flagstick’s length.' },
      { term: 'Arnie', text: 'Par or better without touching the fairway.' },
    ],
  }
}

function finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult {
  const c = compute(ctx, entries)
  const top = c.standings[0]
  const winners = c.standings.filter((r) => r.rank === 1).map((r) => r.playerId)
  const dotCount = c.outcomes.reduce(
    (t, o) => t + Object.values(o.points).filter((v) => v !== 0).length,
    0,
  )
  return {
    headline: winners.length > 1 ? 'Shared' : `${nameOf(ctx.players, top.playerId)} collects the most`,
    subhead: `${top.display} dots`,
    winners,
    standings: c.standings,
    lines: [`${dotCount} dots handed out over ${c.outcomes.length} holes`],
  }
}

export const dotsGame: GolfGame = {
  meta: {
    id: 'dots',
    name: 'Dots',
    emoji: '⭐',
    tagline: 'Earn points for birdies, greenies, sandies and everything else worth doing.',
    playersLabel: '2–4 Players',
    minPlayers: 2,
    maxPlayers: 4,
    bestFor: 'Any group',
    complexity: 2,
    strategy: 2,
    complexityLabel: 'Easy',
    strategyLabel: 'Low',
    swing: 'Low',
    accent: 'dots',
  },
  settings: dotsSettings,
  defaultSettings: () => defaultsFrom(dotsSettings),
  validatePlayers: (n) => (n < 2 ? 'Dots needs at least 2 players.' : n > 4 ? 'This app supports up to 4 players.' : null),
  createRoundState: () => ({}),
  compute,
  finalResult,
  explain,
  preScoreStage: null,
}
