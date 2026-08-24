/**
 * VEGAS
 *
 * Two pairs. Each pair's two scores are pushed together into a two-digit number
 * — a 4 and a 5 make forty-five, not nine. The difference between the two
 * numbers is the points swing, and it can be brutal.
 */

import { holeByNumber } from '../../core/course'
import {
  completedEntries,
  effectiveScores,
  namesOf,
  netContextFrom,
  rankRows,
  signed,
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
  Player,
  PlayerId,
  RulesDoc,
  SettingDef,
  SettingsValues,
  StatusChip,
} from '../../core/types'

const SCORING = 'Vegas rules'
const STAKES = 'Stakes'

export const vegasSettings: SettingDef[] = [
  num('pointMultiplier', 'Point multiplier', 1, {
    group: STAKES, min: 1, max: 20, presets: [1, 2, 5], suffix: '×',
    help: 'Every point of difference is worth this much.',
  }),
  choice('flipRule', 'Flip rule', 'off', [
    { value: 'off', label: 'No flipping', help: 'Numbers always read lowest first.' },
    { value: 'birdie', label: 'Birdie flips', help: 'A birdie flips the other team’s number — 56 becomes 65.' },
    { value: 'naturalBirdie', label: 'Natural birdie only', help: 'Only a birdie made without a handicap shot flips.' },
    { value: 'eagle', label: 'Eagle flips', help: 'Only an eagle or better flips the other team.' },
  ], { group: SCORING }),
  choice('maxLossMode', 'Cap on one hole', 'none', [
    { value: 'none', label: 'No cap', help: 'A blow-up hole costs whatever it costs.' },
    { value: 'cap', label: 'Cap it', help: 'Nobody loses more than the set amount on one hole.' },
  ], { group: SCORING }),
  num('maxLoss', 'Maximum per hole', 20, {
    group: SCORING, min: 1, max: 200, presets: [10, 20, 50], suffix: 'pts',
    visibleWhen: (s) => s.maxLossMode === 'cap',
  }),
  toggle('birdieBonus', 'Birdie bonus', false, {
    group: SCORING, help: 'Extra points on top of the difference for each birdie.',
  }),
  num('birdieBonusPoints', 'Birdie bonus points', 5, {
    group: SCORING, min: 1, max: 50, suffix: 'pts', visibleWhen: (s) => !!s.birdieBonus, advanced: true,
  }),
  toggle('eagleBonus', 'Eagle bonus', false, { group: SCORING }),
  num('eagleBonusPoints', 'Eagle bonus points', 10, {
    group: SCORING, min: 1, max: 100, suffix: 'pts', visibleWhen: (s) => !!s.eagleBonus, advanced: true,
  }),
  choice('teamRotation', 'Teams', 'fixed', [
    { value: 'fixed', label: 'Fixed for the round' },
    { value: 'six', label: 'Change every 6 holes', help: 'Everyone partners everyone — a Vegas and Sixes hybrid.' },
  ], { group: 'Teams' }),
  grossNetSetting(),
  ...handicapSettings(90, 'Vegas is a four-ball style format; 90% off the low player keeps it fair without killing the swings.'),
  pointValueSetting(),
]

/* -------------------------------------------------------------------- teams */

/** The three ways four players can be split into two pairs. */
export function pairingForBlock(ids: PlayerId[], block: number): [PlayerId[], PlayerId[]] {
  const [a, b, c, d] = ids
  const options: [PlayerId[], PlayerId[]][] = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ]
  return options[block % 3]
}

export function teamsForHole(
  ctx: GameContext,
  hole: number,
): [PlayerId[], PlayerId[]] {
  const ids = ctx.players.map((p) => p.id)
  if (ctx.settings.teamRotation === 'six') {
    const block = Math.floor((hole - 1) / 6)
    return pairingForBlock(ids, block)
  }
  const teams = ctx.gameState.teams as PlayerId[][] | undefined
  if (teams && teams.length === 2) return [teams[0], teams[1]]
  return [ids.slice(0, 2), ids.slice(2, 4)]
}

/* ------------------------------------------------------------ vegas number */

/**
 * Two scores become one number, lowest digit first: 4 and 5 -> 45.
 * Scores of ten or more are simply written out, so 4 and 10 -> 410. That is
 * the usual convention and it keeps the "big number is bad" logic intact.
 */
export function vegasNumber(a: number, b: number, flipped = false): number {
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  const [first, second] = flipped ? [high, low] : [low, high]
  return Number(`${first}${second}`)
}

/* ----------------------------------------------------------------- compute */

interface HoleCalc {
  hole: number
  teams: [PlayerId[], PlayerId[]]
  numbers: [number, number]
  raw: [number, number]
  flipped: [boolean, boolean]
  diff: number
  winner: 0 | 1 | null
  points: number
  bonus: [number, number]
  scores: Record<PlayerId, number | null>
}

export function calcHole(ctx: GameContext, entry: HoleEntry): HoleCalc | null {
  const net = netContextFrom(ctx, 90)
  const scores = effectiveScores(ctx, net, entry)
  const gross = entry.scores
  const teams = teamsForHole(ctx, entry.hole)
  const par = holeByNumber(ctx.course, entry.hole).par

  const values = teams.map((team) => team.map((id) => scores[id]))
  if (values.some((pair) => pair.some((v) => v == null))) return null

  const flipRule = ctx.settings.flipRule as string
  const qualifies = (team: PlayerId[]): boolean => {
    if (flipRule === 'off') return false
    return team.some((id) => {
      const g = gross[id]
      const n = scores[id]
      if (g == null || n == null) return false
      if (flipRule === 'eagle') return n <= par - 2
      if (flipRule === 'naturalBirdie') return g <= par - 1
      return n <= par - 1
    })
  }
  // A qualifying score flips the OTHER team's number.
  const flipped: [boolean, boolean] = [qualifies(teams[1]), qualifies(teams[0])]

  const raw: [number, number] = [
    vegasNumber(values[0][0]!, values[0][1]!, false),
    vegasNumber(values[1][0]!, values[1][1]!, false),
  ]
  const numbers: [number, number] = [
    vegasNumber(values[0][0]!, values[0][1]!, flipped[0]),
    vegasNumber(values[1][0]!, values[1][1]!, flipped[1]),
  ]

  const diff = Math.abs(numbers[0] - numbers[1])
  const winner: 0 | 1 | null = numbers[0] === numbers[1] ? null : numbers[0] < numbers[1] ? 0 : 1
  const multiplier = Number(ctx.settings.pointMultiplier ?? 1)
  let points = diff * multiplier
  if (ctx.settings.maxLossMode === 'cap') points = Math.min(points, Number(ctx.settings.maxLoss ?? 20))

  const bonusFor = (team: PlayerId[]): number => {
    let b = 0
    for (const id of team) {
      const n = scores[id]
      if (n == null) continue
      if (ctx.settings.eagleBonus && n <= par - 2) b += Number(ctx.settings.eagleBonusPoints ?? 10)
      else if (ctx.settings.birdieBonus && n === par - 1) b += Number(ctx.settings.birdieBonusPoints ?? 5)
    }
    return b
  }

  return {
    hole: entry.hole,
    teams,
    numbers,
    raw,
    flipped,
    diff,
    winner,
    points,
    bonus: [bonusFor(teams[0]), bonusFor(teams[1])],
    scores,
  }
}

function compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound {
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)
  const outcomes: HoleOutcome[] = []
  const calcs: HoleCalc[] = []

  for (const e of done) {
    const calc = calcHole(ctx, e)
    const points: Record<PlayerId, number> = Object.fromEntries(ctx.players.map((p) => [p.id, 0]))
    if (!calc) {
      outcomes.push({ hole: e.hole, points, headline: 'Waiting for scores', pending: true })
      continue
    }
    calcs.push(calc)

    const detail: string[] = [
      `${namesOf(ctx.players, calc.teams[0])} ${calc.numbers[0]}${calc.flipped[0] ? ' (flipped)' : ''} v ${namesOf(ctx.players, calc.teams[1])} ${calc.numbers[1]}${calc.flipped[1] ? ' (flipped)' : ''}`,
    ]

    let headline: string
    if (calc.winner === null) {
      headline = 'Tied hole — no points'
    } else {
      const winTeam = calc.teams[calc.winner]
      const loseTeam = calc.teams[calc.winner === 0 ? 1 : 0]
      for (const id of winTeam) points[id] += calc.points
      for (const id of loseTeam) points[id] -= calc.points
      headline = `${namesOf(ctx.players, winTeam)} +${calc.points}`
    }
    // Bonuses sit on top of the difference and are not capped.
    ;[0, 1].forEach((t) => {
      const bonus = calc.bonus[t]
      if (!bonus) return
      for (const id of calc.teams[t]) points[id] += bonus
      for (const id of calc.teams[t === 0 ? 1 : 0]) points[id] -= bonus
      detail.push(`${namesOf(ctx.players, calc.teams[t])} bonus +${bonus}`)
    })

    outcomes.push({ hole: e.hole, points, headline, detail })
  }

  const totals = sumPoints(outcomes.map((o) => o.points), ctx.players)
  const pointValue = Number(ctx.settings.pointValue ?? 0)
  const standings = rankRows(
    ctx.players.map((p) => ({
      playerId: p.id,
      value: tidy(totals[p.id] ?? 0),
      display: signed(tidy(totals[p.id] ?? 0)),
      sub: moneyLabel(totals[p.id] ?? 0, pointValue),
    })),
    true,
  )
  const prevTotals = sumPoints(outcomes.slice(0, -1).map((o) => o.points), ctx.players)
  const previous = rankRows(
    ctx.players.map((p) => ({ playerId: p.id, value: prevTotals[p.id] ?? 0, display: '' })),
    true,
  )

  const nextHole = (done[done.length - 1]?.hole ?? 0) + 1
  const teams = teamsForHole(ctx, Math.min(nextHole, 18))
  // The team names are already on screen in the HUD, so the strip says the one
  // thing the HUD cannot: who is up on the round, and by how much.
  // Every player on the winning side gains what the losing side drops, so one
  // player's running total is the whole story.
  const greenPerPlayer = tidy(totals[teams[0][0]] ?? 0)
  const status: StatusChip[] = [
    greenPerPlayer === 0
      ? { label: 'Round', value: 'All square', tone: 'neutral' }
      : {
          label: 'Round',
          value: `${namesOf(ctx.players, greenPerPlayer > 0 ? teams[0] : teams[1])} ${signed(Math.abs(greenPerPlayer))}`,
          tone: 'good',
        },
  ]

  return {
    outcomes,
    standings: withMovement(standings, previous),
    status,
    teams: [
      { id: 'A', name: namesOf(ctx.players, teams[0]), playerIds: teams[0], colorKey: 'green' },
      { id: 'B', name: namesOf(ctx.players, teams[1]), playerIds: teams[1], colorKey: 'sand' },
    ],
    extra: { calcs, teams },
  }
}

function explain(s: SettingsValues): RulesDoc {
  const flip = {
    off: 'Flipping is switched off in this round.',
    birdie: 'A birdie by either player flips the opposing team’s number — their 56 becomes 65.',
    naturalBirdie: 'A birdie made without a handicap shot flips the opposing team’s number.',
    eagle: 'Only an eagle flips the opposing team’s number.',
  }[(s.flipRule as string)] ?? 'Flipping is switched off in this round.'

  return {
    summary:
      'Four players, two pairs. Each pair’s two scores are put side by side to make one number, lowest first. The pair with the lower number wins the difference in points.',
    sections: [
      {
        title: 'The number is not a total',
        body: [
          'A 4 and a 5 make 45. Not 9. The scores are written next to each other, not added up.',
          'The lower score always goes first: a 3 and a 6 make 36, never 63.',
          'One bad hole from one partner can turn a 45 into a 49 — which is why Vegas swings so hard.',
        ],
      },
      {
        title: 'Scoring the hole',
        body: [
          'Take the difference between the two team numbers.',
          `Each point of difference is worth ${s.pointMultiplier} point${Number(s.pointMultiplier) === 1 ? '' : 's'}.`,
          'The winning pair gains that amount and the losing pair loses it, so the table always balances.',
          s.maxLossMode === 'cap'
            ? `No hole can cost more than ${s.maxLoss} points.`
            : 'There is no cap — a disaster hole costs the full amount.',
        ],
      },
      { title: 'Flipping', body: [flip, 'Flipping exists because a good score deserves to hurt the other side. It is optional and every group plays it differently.'] },
      ...(s.teamRotation === 'six'
        ? [{ title: 'Rotating partners', body: ['Teams change every six holes so everyone partners everyone.', 'Holes 1–6, 7–12 and 13–18 each have a different pairing.'] }]
        : []),
    ],
    example: {
      title: 'Hole 7',
      rows: [
        { label: 'Marc', value: '4' },
        { label: 'Phil', value: '5' },
        { label: 'Team A number', value: '45', emphasis: true },
        { label: 'Mike', value: '3' },
        { label: 'John', value: '6' },
        { label: 'Team B number', value: '36', emphasis: true },
        { label: 'Difference', value: '9' },
      ],
      result: `Mike + John win ${9 * Number(s.pointMultiplier ?? 1)} points`,
    },
    variations: [
      { name: 'Birdie flip', text: 'A birdie flips the other team’s number.', active: s.flipRule === 'birdie' || s.flipRule === 'naturalBirdie' },
      { name: 'Point cap', text: 'Limits the damage of one catastrophic hole.', active: s.maxLossMode === 'cap' },
      { name: 'Rotating partners', text: 'New pairing every six holes.', active: s.teamRotation === 'six' },
      { name: 'Birdie / eagle bonus', text: 'Flat extra points for a good score.', active: !!s.birdieBonus || !!s.eagleBonus },
    ],
    definitions: [
      { term: 'Team number', text: 'The two partners’ scores written side by side, lowest first.' },
      { term: 'Flip', text: 'Reversing the other team’s number so the higher score reads first.' },
      { term: 'The difference', text: 'What the hole is worth. 45 against 36 is nine points.' },
    ],
  }
}

function finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult {
  const c = compute(ctx, entries)
  const calcs = (c.extra?.calcs ?? []) as HoleCalc[]
  const biggest = calcs.reduce<HoleCalc | null>((best, cur) => (!best || cur.points > best.points ? cur : best), null)
  const top = c.standings[0]
  const winners = c.standings.filter((r) => r.rank === 1).map((r) => r.playerId)
  return {
    headline: `${namesOf(ctx.players, winners)} ${winners.length > 1 ? 'come out on top' : 'wins'}`,
    subhead: top.display,
    winners,
    standings: c.standings,
    lines: [
      `${calcs.length} holes scored`,
      ...(biggest && biggest.winner !== null
        ? [`Biggest hole: ${biggest.numbers[0]} v ${biggest.numbers[1]} on hole ${biggest.hole} · ${biggest.points} points`]
        : []),
    ],
  }
}

export const vegasGame: GolfGame = {
  meta: {
    id: 'vegas',
    name: 'Vegas',
    emoji: '🎰',
    tagline: 'Team scores combine into numbers, creating big swings and dramatic holes.',
    playersLabel: '4 Players',
    minPlayers: 4,
    maxPlayers: 4,
    bestFor: '4 golfers',
    complexity: 3,
    strategy: 4,
    complexityLabel: 'Medium',
    strategyLabel: 'High',
    swing: 'Very High',
    accent: 'vegas',
  },
  settings: vegasSettings,
  defaultSettings: () => defaultsFrom(vegasSettings),
  validatePlayers: (n) => (n !== 4 ? 'Vegas is a four-player game — two pairs.' : null),
  createRoundState: (ctx: { players: Player[] }) => ({
    teams: [ctx.players.slice(0, 2).map((p) => p.id), ctx.players.slice(2, 4).map((p) => p.id)],
  }),
  compute,
  finalResult,
  explain,
  preScoreStage: 'teams',
}
