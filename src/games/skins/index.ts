/**
 * SKINS
 *
 * Every hole is worth a prize. Lowest score takes it. Tie it and nobody wins —
 * the skin rolls into the next hole and the pot grows.
 */

import {
  completedEntries,
  effectiveScores,
  nameOf,
  namesOf,
  netContextFrom,
  playersWithLowest,
  rankRows,
  sumPoints,
  tidy,
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
  toggle,
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

const POT_GROUP = 'The pot'
const RULES_GROUP = 'Rules'

export const skinsSettings: SettingDef[] = [
  num('skinValue', 'Skin value', 1, {
    group: POT_GROUP,
    min: 1,
    max: 100,
    presets: [1, 2, 5, 10],
    suffix: 'pts',
    help: 'What one skin is worth. Every hole is worth this by default.',
  }),
  choice('carryRule', 'When a hole is tied', 'carry', [
    { value: 'carry', label: 'Carry it forward', help: 'Nobody wins. The next hole is worth both skins.' },
    { value: 'none', label: 'No carry', help: 'The skin is simply lost. Each hole stands alone.' },
    { value: 'split', label: 'Split the skin', help: 'Tied players share the skin equally.' },
  ], { group: POT_GROUP }),
  toggle('progressive', 'Progressive skins', false, {
    group: POT_GROUP,
    help: 'Later holes are automatically worth more, so the round builds to a finish.',
  }),
  num('progressiveTier2', 'Holes 7–12 worth', 2, {
    group: POT_GROUP, min: 1, max: 20, suffix: 'skins',
    visibleWhen: (s) => !!s.progressive, advanced: true,
  }),
  num('progressiveTier3', 'Holes 13–17 worth', 3, {
    group: POT_GROUP, min: 1, max: 20, suffix: 'skins',
    visibleWhen: (s) => !!s.progressive, advanced: true,
  }),
  num('progressiveTier4', 'Hole 18 worth', 5, {
    group: POT_GROUP, min: 1, max: 30, suffix: 'skins',
    visibleWhen: (s) => !!s.progressive, advanced: true,
  }),
  {
    type: 'holeValues',
    key: 'customHoleValues',
    label: 'Custom hole values',
    group: POT_GROUP,
    default: {},
    advanced: true,
    help: 'Give individual holes their own value — a 5-skin 18th, an island green, whatever your group likes.',
  },
  toggle('validation', 'Validation skins', false, {
    group: RULES_GROUP,
    help: 'A skin is only yours once you tie or win the following hole. Otherwise it goes back into the pot.',
  }),
  choice('finalHoleTie', 'If the last hole is tied', 'split', [
    { value: 'split', label: 'Split the pot', help: 'The tied players share whatever is left.' },
    { value: 'void', label: 'Pot is void', help: 'Nobody takes it. Harsh, but quick.' },
    { value: 'playoff', label: 'Carry to a play-off', help: 'The app shows the pot as undecided.' },
  ], { group: RULES_GROUP }),
  grossNetSetting(),
  ...handicapSettings(100, 'Skins is usually played off full handicap or off the low player. 100% is standard.'),
  pointValueSetting(),
]

/** Skins on offer for one hole, before any carry-over is added. */
export function holeSkinValue(settings: SettingsValues, hole: number): number {
  const custom = (settings.customHoleValues ?? {}) as Record<string, number>
  if (custom[String(hole)] != null) return Number(custom[String(hole)])
  if (!settings.progressive) return 1
  if (hole >= 18) return Number(settings.progressiveTier4 ?? 5)
  if (hole >= 13) return Number(settings.progressiveTier3 ?? 3)
  if (hole >= 7) return Number(settings.progressiveTier2 ?? 2)
  return 1
}

interface PendingWin {
  hole: number
  playerId: PlayerId
  skins: number
}

function compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound {
  const net = netContextFrom(ctx)
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)
  const lastHole = ctx.course.holes[ctx.course.holes.length - 1]?.number ?? 18
  const skinValue = Number(ctx.settings.skinValue ?? 1)

  const outcomes: HoleOutcome[] = []
  let carried = 0
  let carriedFrom: number[] = []
  let pending: PendingWin | null = null
  let undecided = 0

  for (const e of done) {
    const scores = effectiveScores(ctx, net, e)
    const points: Record<PlayerId, number> = {}
    for (const p of ctx.players) points[p.id] = 0
    const detail: string[] = []

    const entered = Object.values(scores).filter((v) => typeof v === 'number').length
    if (entered < 2) {
      outcomes.push({ hole: e.hole, points, headline: 'Waiting for scores', pending: true })
      continue
    }

    const winners = playersWithLowest(scores)
    const isLast = e.hole === lastHole

    // Validation: settle the previous hole's provisional win before pricing this one.
    // Skins that fail to validate drop straight back into the pot being played for.
    let returned = 0
    if (pending) {
      const validated = winners.includes(pending.playerId)
      if (validated) {
        points[pending.playerId] = (points[pending.playerId] ?? 0) + pending.skins * skinValue
        detail.push(`${nameOf(ctx.players, pending.playerId)} validated ${pending.skins} skin${pending.skins === 1 ? '' : 's'} from hole ${pending.hole}.`)
      } else {
        returned = pending.skins
        detail.push(`${nameOf(ctx.players, pending.playerId)} failed to validate hole ${pending.hole} — ${pending.skins} skin${pending.skins === 1 ? '' : 's'} back in the pot.`)
      }
      pending = null
    }

    const potThisHole = holeSkinValue(ctx.settings, e.hole) + carried + returned

    let headline: string
    if (winners.length === 1) {
      const winner = winners[0]
      const useValidation = !!ctx.settings.validation && !isLast
      if (useValidation) {
        pending = { hole: e.hole, playerId: winner, skins: potThisHole }
        headline = `${nameOf(ctx.players, winner)} wins ${potThisHole} skin${potThisHole === 1 ? '' : 's'} — must validate on hole ${e.hole + 1}`
      } else {
        points[winner] = (points[winner] ?? 0) + potThisHole * skinValue
        headline = `${nameOf(ctx.players, winner)} wins ${potThisHole} skin${potThisHole === 1 ? '' : 's'}`
      }
      carried = 0
      carriedFrom = []
    } else {
      // Tied hole.
      const rule = ctx.settings.carryRule as string
      if (isLast && rule === 'carry') {
        const fin = ctx.settings.finalHoleTie as string
        if (fin === 'split') {
          const each = (potThisHole * skinValue) / winners.length
          for (const id of winners) points[id] = (points[id] ?? 0) + each
          headline = `Last hole tied — ${potThisHole} skins split between ${namesOf(ctx.players, winners)}`
        } else if (fin === 'void') {
          headline = `Last hole tied — ${potThisHole} skins void`
        } else {
          undecided = potThisHole
          headline = `Last hole tied — ${potThisHole} skins go to a play-off`
        }
        carried = 0
        carriedFrom = []
      } else if (rule === 'split') {
        const each = (potThisHole * skinValue) / winners.length
        for (const id of winners) points[id] = (points[id] ?? 0) + each
        headline = `Tied — ${potThisHole} skin${potThisHole === 1 ? '' : 's'} split between ${namesOf(ctx.players, winners)}`
        carried = 0
        carriedFrom = []
      } else if (rule === 'none') {
        headline = `Tied — no skin on hole ${e.hole}`
        carried = 0
        carriedFrom = []
      } else {
        carried = potThisHole
        carriedFrom = [...carriedFrom, e.hole]
        headline = `Tied — ${carried} skin${carried === 1 ? '' : 's'} carry to hole ${e.hole + 1}`
      }
    }

    if (detail.length === 0 && carriedFrom.length) {
      detail.push(`Carried from hole${carriedFrom.length > 1 ? 's' : ''} ${carriedFrom.join(', ')}.`)
    }
    outcomes.push({ hole: e.hole, points, headline, detail })
  }

  // A provisional win still standing at the end of the round is honoured.
  if (pending) {
    const last = outcomes[outcomes.length - 1]
    if (last) {
      last.points[pending.playerId] = (last.points[pending.playerId] ?? 0) + pending.skins * skinValue
    }
  }

  const totals = sumPoints(outcomes.map((o) => o.points), ctx.players)
  const pointValue = Number(ctx.settings.pointValue ?? 0)
  const rows = ctx.players.map((p) => {
    const v = tidy(totals[p.id] ?? 0)
    return {
      playerId: p.id,
      value: v,
      display: `${v}`,
      sub: moneyLabel(v, pointValue),
    }
  })
  const standings = rankRows(rows, true)
  const prevTotals = sumPoints(outcomes.slice(0, -1).map((o) => o.points), ctx.players)
  const previous = rankRows(
    ctx.players.map((p) => ({ playerId: p.id, value: prevTotals[p.id] ?? 0, display: '' })),
    true,
  )

  const nextHole = (done[done.length - 1]?.hole ?? 0) + 1
  const nextPot = holeSkinValue(ctx.settings, nextHole) + carried
  // The pot itself is shown large by the Skins HUD, so the strip only carries
  // what the HUD does not: how long the carry has been running.
  const status: StatusChip[] = []
  if (carried > 0) {
    status.push({
      label: 'Carried',
      value: `${carriedFrom.length} hole${carriedFrom.length === 1 ? '' : 's'}`,
      tone: 'accent',
    })
  }

  return {
    outcomes,
    standings: withMovement(standings, previous),
    status,
    extra: { pot: nextPot, carried, carriedFrom, undecided, pendingValidation: pending },
  }
}

function explain(s: SettingsValues): RulesDoc {
  const carry = {
    carry: 'the skin carries into the next hole, so the next hole is worth two',
    none: 'the skin is lost — each hole stands on its own',
    split: 'the tied players share the skin',
  }[(s.carryRule as string) ?? 'carry']

  return {
    summary:
      'Each hole is a separate prize called a skin. The lowest score on the hole wins it outright — but tie the hole and nobody wins, so the prize rolls forward and the next hole is worth more.',
    sections: [
      {
        title: 'Winning a skin',
        body: [
          'Everyone plays their own ball. The single lowest score on the hole wins the skin.',
          'Two or more players tied for lowest means no winner — even if one of them is having a great round.',
          `Tied hole: ${carry}.`,
        ],
      },
      {
        title: 'The pot',
        body: [
          `Every hole is worth ${s.skinValue} point${Number(s.skinValue) === 1 ? '' : 's'} per skin.`,
          ...(s.progressive
            ? [
                `Progressive skins are on: holes 1–6 are worth 1 skin, 7–12 are worth ${s.progressiveTier2}, 13–17 are worth ${s.progressiveTier3} and the 18th is worth ${s.progressiveTier4}.`,
              ]
            : []),
          'The running pot is always shown at the top of the hole screen, so everyone knows what is on the table before they hit.',
        ],
      },
      ...(s.validation
        ? [
            {
              title: 'Validation',
              body: [
                'A skin is only provisional until you tie or win the following hole.',
                'Fail to validate and the skin drops back into the pot for everyone.',
                'This is an optional rule that some groups use to stop one lucky hole deciding the money.',
              ],
            },
          ]
        : []),
    ],
    example: {
      title: 'A carry-over',
      rows: [
        { label: 'Hole 1 — Marc 4, Phil 5, Mike 5, John 6', value: 'Marc wins 1 skin', emphasis: true },
        { label: 'Hole 2 — Marc 4, Phil 4, Mike 5, John 6', value: 'Tied. No winner.' },
        { label: 'Hole 3 is now worth', value: '2 skins', emphasis: true },
        { label: 'Hole 3 — Mike lowest', value: 'Mike wins 2 skins' },
      ],
      result: 'Marc 1 · Mike 2 · Phil 0 · John 0',
    },
    variations: [
      { name: 'Carry-overs', text: 'Tied holes roll forward. The classic way to play.', active: s.carryRule === 'carry' },
      { name: 'No carry', text: 'Each hole stands alone — quicker and flatter.', active: s.carryRule === 'none' },
      { name: 'Split skins', text: 'Tied players share the hole.', active: s.carryRule === 'split' },
      { name: 'Validation skins', text: 'You must tie or better the next hole to keep a skin.', active: !!s.validation },
      { name: 'Progressive skins', text: 'Later holes are worth more, so the round builds.', active: !!s.progressive },
    ],
    definitions: [
      { term: 'Skin', text: 'The prize attached to a single hole.' },
      { term: 'Carry', text: 'A skin nobody won, added to the next hole.' },
      { term: 'Pot', text: 'Everything on offer on the hole you are about to play.' },
    ],
  }
}

function finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult {
  const c = compute(ctx, entries)
  const winners = c.standings.filter((r) => r.rank === 1 && r.value > 0).map((r) => r.playerId)
  const top = c.standings[0]
  const holesWon = c.outcomes.filter((o) => Object.values(o.points).some((v) => v > 0)).length
  return {
    headline: winners.length === 0 ? 'No skins won' : winners.length > 1 ? 'Shared at the top' : `${nameOf(ctx.players, top.playerId)} takes the skins`,
    subhead: `${top.value} skin${top.value === 1 ? '' : 's'}`,
    winners,
    standings: c.standings,
    lines: [
      `${holesWon} of ${c.outcomes.length} holes produced a winner`,
      ...(c.extra?.undecided ? [`${c.extra.undecided} skins still to be decided in a play-off`] : []),
    ],
  }
}

export const skinsGame: GolfGame = {
  meta: {
    id: 'skins',
    name: 'Skins',
    emoji: '🏆',
    tagline: 'Every hole has a prize. Ties make the next one bigger.',
    playersLabel: '2–4 Players',
    minPlayers: 2,
    maxPlayers: 4,
    bestFor: '3–4 golfers',
    complexity: 1,
    strategy: 3,
    complexityLabel: 'Easy',
    strategyLabel: 'Medium',
    swing: 'Medium',
    accent: 'skins',
  },
  settings: skinsSettings,
  defaultSettings: () => defaultsFrom(skinsSettings),
  validatePlayers: (n) => (n < 2 ? 'Skins needs at least 2 players.' : n > 4 ? 'This app supports up to 4 players.' : null),
  createRoundState: () => ({}),
  compute,
  finalResult,
  explain,
  preScoreStage: null,
}
