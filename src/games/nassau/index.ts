/**
 * NASSAU
 *
 * Three match-play bets running at once over the same 18 holes: the front nine,
 * the back nine, and the whole round. Presses open extra bets mid-round when a
 * side falls behind.
 */

import {
  bestBall,
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

export type Segment = 'front' | 'back' | 'overall'
export type Side = 'A' | 'B'

export interface Matchup {
  id: string
  sideA: PlayerId[]
  sideB: PlayerId[]
  labelA: string
  labelB: string
}

export interface PressRecord {
  id: string
  matchupId: string
  segment: Segment
  /** The press covers holes from here to the end of its segment. */
  startHole: number
  by: Side
  auto: boolean
  parentId: string
}

export interface MatchLine {
  id: string
  matchupId: string
  segment: Segment
  label: string
  startHole: number
  endHole: number
  value: number
  isPress: boolean
  /** Positive = side A up by that many holes. */
  diff: number
  holesPlayed: number
  holesRemaining: number
  decided: boolean
  winner: Side | null
  status: string
}

const STAKES = 'Stakes'
const FORMAT = 'Format'
const PRESSES = 'Presses'

export const nassauSettings: SettingDef[] = [
  choice('playType', 'Played as', 'auto', [
    { value: 'auto', label: 'Automatic', help: '2 players go head to head; 4 players play as two teams.' },
    { value: 'individual', label: 'Every player for themselves', help: 'Each pair plays their own Nassau.' },
    { value: 'teams', label: 'Two teams', help: 'Four-ball: the better ball of each pair counts.' },
  ], { group: FORMAT }),
  num('frontValue', 'Front nine', 1, {
    group: STAKES, min: 0, max: 100, presets: [1, 2, 5, 10], suffix: 'pts',
    help: 'What winning holes 1–9 is worth.',
  }),
  num('backValue', 'Back nine', 1, {
    group: STAKES, min: 0, max: 100, presets: [1, 2, 5, 10], suffix: 'pts',
  }),
  num('overallValue', 'Overall 18', 1, {
    group: STAKES, min: 0, max: 100, presets: [1, 2, 5, 10], suffix: 'pts',
  }),
  toggle('pressesEnabled', 'Presses', false, {
    group: PRESSES,
    help: 'A press opens a brand new bet over the remaining holes of that nine.',
  }),
  toggle('autoPress', 'Automatic presses', true, {
    group: PRESSES,
    help: 'A new press starts by itself as soon as a side falls far enough behind.',
    visibleWhen: (s) => !!s.pressesEnabled,
  }),
  num('pressTrigger', 'Press when a side is', 2, {
    group: PRESSES, min: 1, max: 5, presets: [1, 2, 3], suffix: 'down',
    visibleWhen: (s) => !!s.pressesEnabled && !!s.autoPress,
  }),
  toggle('rePress', 'Re-presses', false, {
    group: PRESSES,
    help: 'A press that goes the same amount down can itself be pressed.',
    visibleWhen: (s) => !!s.pressesEnabled,
  }),
  toggle('pressOverall', 'Press the overall match too', false, {
    group: PRESSES,
    help: 'Off by default — most groups only press the nine they are playing.',
    visibleWhen: (s) => !!s.pressesEnabled,
    advanced: true,
  }),
  choice('pressValueMode', 'A press is worth', 'same', [
    { value: 'same', label: 'Same as the bet' },
    { value: 'custom', label: 'Custom' },
  ], { group: PRESSES, visibleWhen: (s) => !!s.pressesEnabled, advanced: true }),
  num('pressValueCustom', 'Press value', 1, {
    group: PRESSES, min: 0, max: 100, suffix: 'pts',
    visibleWhen: (s) => !!s.pressesEnabled && s.pressValueMode === 'custom',
    advanced: true,
  }),
  grossNetSetting(),
  ...handicapSettings(90, 'Four-Ball match play is normally 90% of course handicap off the lowest player; singles match play is 100%.'),
  pointValueSetting(),
]

/* ------------------------------------------------------------------ matchups */

export function buildMatchups(players: Player[], settings: SettingsValues, gameState: Record<string, any>): Matchup[] {
  const ids = players.map((p) => p.id)
  const name = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? '?'
  const mode =
    settings.playType === 'auto' ? (players.length === 4 ? 'teams' : 'individual') : settings.playType

  if (mode === 'teams' && players.length === 4) {
    const teams: PlayerId[][] = gameState.teams ?? [ids.slice(0, 2), ids.slice(2, 4)]
    return [
      {
        id: 'm_teams',
        sideA: teams[0],
        sideB: teams[1],
        labelA: gameState.teamNames?.[0] ?? teams[0].map(name).join(' + '),
        labelB: gameState.teamNames?.[1] ?? teams[1].map(name).join(' + '),
      },
    ]
  }

  const out: Matchup[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      out.push({
        id: `m_${ids[i]}_${ids[j]}`,
        sideA: [ids[i]],
        sideB: [ids[j]],
        labelA: name(ids[i]),
        labelB: name(ids[j]),
      })
    }
  }
  return out
}

function segmentBounds(segment: Segment, holes: number[]): [number, number] {
  const front = holes.filter((h) => h <= 9)
  const back = holes.filter((h) => h > 9)
  if (segment === 'front') return [front[0] ?? holes[0], front[front.length - 1] ?? holes[0]]
  if (segment === 'back') return [back[0] ?? holes[0], back[back.length - 1] ?? holes[holes.length - 1]]
  return [holes[0], holes[holes.length - 1]]
}

function statusLabel(m: { diff: number; decided: boolean; holesRemaining: number; holesPlayed: number }): string {
  if (m.holesPlayed === 0) return 'Not started'
  const lead = Math.abs(m.diff)
  if (m.decided) {
    if (lead === 0) return 'Halved'
    if (m.holesRemaining === 0) return `${lead} UP`
    return `${lead} & ${m.holesRemaining}`
  }
  if (lead === 0) return 'AS'
  if (lead === m.holesRemaining) return `${lead} UP · DORMIE`
  return `${lead} UP`
}

/* ------------------------------------------------------------------ compute */

interface HoleWin {
  hole: number
  winner: Side | null // null = halved
}

function holeWins(ctx: GameContext, matchup: Matchup, entries: HoleEntry[]): HoleWin[] {
  const net = netContextFrom(ctx, 90)
  return entries.map((e) => {
    const scores = effectiveScores(ctx, net, e)
    const conceded = (e.game?.conceded ?? null) as Side | null
    if (conceded) return { hole: e.hole, winner: conceded === 'A' ? 'B' : ('A' as Side) }
    const a = bestBall(scores, matchup.sideA)
    const b = bestBall(scores, matchup.sideB)
    if (a == null || b == null) return { hole: e.hole, winner: null }
    if (a === b) return { hole: e.hole, winner: null }
    return { hole: e.hole, winner: a < b ? 'A' : 'B' }
  })
}

export function buildMatchLines(
  ctx: GameContext,
  matchup: Matchup,
  entries: HoleEntry[],
): MatchLine[] {
  const holes = ctx.course.holes.map((h) => h.number)
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)
  const wins = holeWins(ctx, matchup, done)
  const winByHole = new Map(wins.map((w) => [w.hole, w.winner]))
  const playedHoles = new Set(done.map((d) => d.hole))

  const s = ctx.settings
  const baseValue: Record<Segment, number> = {
    front: Number(s.frontValue ?? 1),
    back: Number(s.backValue ?? 1),
    overall: Number(s.overallValue ?? 1),
  }
  const pressValue = (seg: Segment) =>
    s.pressValueMode === 'custom' ? Number(s.pressValueCustom ?? 1) : baseValue[seg]

  const hasBack = holes.some((h) => h > 9)
  const hasFront = holes.some((h) => h <= 9)

  const lines: MatchLine[] = []
  const push = (
    id: string,
    segment: Segment,
    label: string,
    startHole: number,
    endHole: number,
    value: number,
    isPress: boolean,
  ) => {
    lines.push({
      id, matchupId: matchup.id, segment, label, startHole, endHole, value, isPress,
      diff: 0, holesPlayed: 0, holesRemaining: 0, decided: false, winner: null, status: 'Not started',
    })
  }

  if (hasFront) {
    const [a, b] = segmentBounds('front', holes)
    push(`${matchup.id}:front`, 'front', 'Front 9', a, b, baseValue.front, false)
  }
  if (hasBack) {
    const [a, b] = segmentBounds('back', holes)
    push(`${matchup.id}:back`, 'back', 'Back 9', a, b, baseValue.back, false)
  }
  if (hasFront && hasBack) {
    const [a, b] = segmentBounds('overall', holes)
    push(`${matchup.id}:overall`, 'overall', 'Overall', a, b, baseValue.overall, false)
  }

  // Manual presses recorded by the players.
  const manual: PressRecord[] = (ctx.gameState.presses ?? []).filter(
    (p: PressRecord) => p.matchupId === matchup.id,
  )
  for (const p of manual) {
    const [, end] = segmentBounds(p.segment, holes)
    push(p.id, p.segment, `Press · ${p.by} pressed`, p.startHole, end, pressValue(p.segment), true)
  }

  // Walk the holes, updating every open line and spawning automatic presses.
  const spawned = new Set<string>()
  const pressesEnabled = !!s.pressesEnabled
  const autoPress = pressesEnabled && !!s.autoPress
  const trigger = Number(s.pressTrigger ?? 2)
  let pressCount = manual.length

  for (const hole of holes) {
    if (!playedHoles.has(hole)) continue
    const winner = winByHole.get(hole) ?? null
    for (const line of lines) {
      if (hole < line.startHole || hole > line.endHole) continue
      line.holesPlayed += 1
      if (winner === 'A') line.diff += 1
      else if (winner === 'B') line.diff -= 1
    }
    if (!autoPress) continue
    for (const line of [...lines]) {
      if (hole < line.startHole || hole >= line.endHole) continue
      if (line.segment === 'overall' && !s.pressOverall) continue
      if (line.isPress && !s.rePress) continue
      if (spawned.has(line.id)) continue
      if (Math.abs(line.diff) < trigger) continue
      spawned.add(line.id)
      pressCount += 1
      const by: Side = line.diff > 0 ? 'B' : 'A'
      push(
        `${line.id}:press${pressCount}`,
        line.segment,
        `Press ${pressCount} · ${by === 'A' ? 'first side' : 'second side'} from hole ${hole + 1}`,
        hole + 1,
        line.endHole,
        pressValue(line.segment),
        true,
      )
      // Catch the new line up on the holes already played in its range (none).
    }
  }

  for (const line of lines) {
    const inRange = holes.filter((h) => h >= line.startHole && h <= line.endHole)
    const playedInRange = inRange.filter((h) => playedHoles.has(h)).length
    line.holesPlayed = playedInRange
    line.holesRemaining = inRange.length - playedInRange
    line.decided = line.holesRemaining === 0 || Math.abs(line.diff) > line.holesRemaining
    line.winner = line.decided ? (line.diff > 0 ? 'A' : line.diff < 0 ? 'B' : null) : null
    line.status = statusLabel(line)
  }

  return lines
}

function compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound {
  const matchups = buildMatchups(ctx.players, ctx.settings, ctx.gameState)
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)
  const allLines = matchups.flatMap((m) => buildMatchLines(ctx, m, entries))

  // Points land on the hole where the bet was settled, so history reads properly.
  const outcomes: HoleOutcome[] = done.map((e) => ({
    hole: e.hole,
    points: Object.fromEntries(ctx.players.map((p) => [p.id, 0])),
    headline: '',
    detail: [],
  }))
  const outcomeByHole = new Map(outcomes.map((o) => [o.hole, o]))

  for (const matchup of matchups) {
    const lines = allLines.filter((l) => l.matchupId === matchup.id)
    const wins = holeWins(ctx, matchup, done)
    for (const w of wins) {
      const o = outcomeByHole.get(w.hole)
      if (!o) continue
      const label =
        w.winner === null
          ? matchups.length === 1
            ? 'Hole halved'
            : `${matchup.labelA} v ${matchup.labelB}: halved`
          : matchups.length === 1
            ? `${w.winner === 'A' ? matchup.labelA : matchup.labelB} win the hole`
            : `${w.winner === 'A' ? matchup.labelA : matchup.labelB} win`
      o.headline = o.headline ? `${o.headline} · ${label}` : label
    }
    for (const line of lines) {
      if (!line.decided || !line.winner || line.value === 0) continue
      const settleHole = settleHoleOf(line, done)
      const o = outcomeByHole.get(settleHole)
      if (!o) continue
      const side = line.winner === 'A' ? matchup.sideA : matchup.sideB
      for (const id of side) o.points[id] = (o.points[id] ?? 0) + line.value
      o.detail = [
        ...(o.detail ?? []),
        `${line.label} won by ${line.winner === 'A' ? matchup.labelA : matchup.labelB} (${line.status}) · ${signed(line.value)}`,
      ]
    }
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

  // The three segments are drawn in full by the Nassau HUD, so the strip only
  // carries what the HUD cannot show at a glance.
  const primary = matchups[0]
  const status: StatusChip[] = []
  const activePresses = allLines.filter((l) => l.isPress && !l.decided).length
  if (activePresses) status.push({ label: 'Presses', value: `${activePresses} live`, tone: 'accent' })
  if (matchups.length > 1) {
    status.push({ label: 'Matches', value: `${matchups.length} running`, tone: 'neutral' })
  }

  return {
    outcomes,
    standings: withMovement(standings, previous),
    status,
    teams:
      matchups.length === 1
        ? [
            { id: 'A', name: primary.labelA, playerIds: primary.sideA, colorKey: 'green' },
            { id: 'B', name: primary.labelB, playerIds: primary.sideB, colorKey: 'sand' },
          ]
        : undefined,
    extra: { matchups, lines: allLines },
  }
}

/** The hole on which a match line was settled — for the history feed. */
function settleHoleOf(line: MatchLine, done: HoleEntry[]): number {
  const played = done.map((d) => d.hole).filter((h) => h >= line.startHole && h <= line.endHole)
  return played[played.length - 1] ?? line.endHole
}

/* --------------------------------------------------------------------- rules */

function explain(s: SettingsValues): RulesDoc {
  return {
    summary:
      'A Nassau is three bets at once: the front nine, the back nine and the full eighteen. Each is a match — you win a hole, you go one up. Losing one bet and winning the other two is a good day.',
    sections: [
      {
        title: 'Three matches, one round',
        body: [
          'The front nine is its own match over holes 1 to 9.',
          'The back nine is its own match over holes 10 to 18.',
          'The overall match runs across all 18 holes.',
          `Winning each is worth ${s.frontValue} / ${s.backValue} / ${s.overallValue} points respectively.`,
        ],
      },
      {
        title: 'Match play, not totals',
        body: [
          'Lowest score on the hole wins the hole. By how much does not matter — a 4 beating a 9 is exactly one hole.',
          'Level is called ALL SQUARE, or AS. One hole ahead is 1 UP.',
          'A match is over as soon as one side leads by more holes than are left. 3 up with 2 to play is written 3 & 2.',
        ],
      },
      ...(s.pressesEnabled
        ? [
            {
              title: 'Presses',
              body: [
                'A press is a brand new bet that starts on the next hole and runs to the end of that nine.',
                s.autoPress
                  ? `A press starts automatically the moment a side goes ${s.pressTrigger} down.`
                  : 'Presses are opened by hand — the side that is behind asks for one.',
                s.rePress
                  ? 'A press that itself falls behind can be pressed again.'
                  : 're-presses are off, so each bet can be pressed once.',
                'Presses never change the original bets. They sit alongside them.',
              ],
            },
          ]
        : []),
    ],
    example: {
      title: 'A typical Nassau',
      rows: [
        { label: 'Front nine', value: 'Lost 2 & 1' },
        { label: 'Back nine', value: 'Won 3 & 2', emphasis: true },
        { label: 'Overall 18', value: 'Won 1 up', emphasis: true },
      ],
      result: `Two of the three bets won · ${Number(s.backValue) + Number(s.overallValue)} points`,
    },
    variations: [
      { name: 'Presses', text: 'Extra bets opened when a side falls behind.', active: !!s.pressesEnabled },
      { name: 'Automatic presses', text: `A new bet opens by itself at ${s.pressTrigger} down.`, active: !!s.pressesEnabled && !!s.autoPress },
      { name: 'Re-presses', text: 'Presses can themselves be pressed.', active: !!s.pressesEnabled && !!s.rePress },
      { name: 'Team Nassau', text: 'Four players as two pairs, better ball counts.', active: s.playType === 'teams' },
      { name: 'Round robin', text: 'With 3 or 4 players everyone plays a Nassau against everyone else.', active: s.playType === 'individual' },
    ],
    definitions: [
      { term: 'AS', text: 'All square — the match is level.' },
      { term: '1 UP', text: 'One hole ahead.' },
      { term: 'Dormie', text: 'Ahead by exactly the number of holes left. You cannot lose from here.' },
      { term: '3 & 2', text: 'Three holes up with only two to play — the match is over.' },
      { term: 'Press', text: 'A new bet started mid-round by the side that is behind.' },
    ],
  }
}

function finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult {
  const c = compute(ctx, entries)
  const lines = (c.extra?.lines ?? []) as MatchLine[]
  const matchups = (c.extra?.matchups ?? []) as Matchup[]
  const top = c.standings[0]
  const winners = c.standings.filter((r) => r.rank === 1).map((r) => r.playerId)
  const summary = lines
    .filter((l) => !l.isPress)
    .map((l) => {
      const m = matchups.find((mm) => mm.id === l.matchupId)!
      const who = l.winner === 'A' ? m.labelA : l.winner === 'B' ? m.labelB : null
      return `${matchups.length > 1 ? `${m.labelA} v ${m.labelB} — ` : ''}${l.label}: ${who ? `${who} ${l.status}` : 'halved'}`
    })
  return {
    headline: winners.length > 1 ? 'Shared' : `${namesOf(ctx.players, [top.playerId])} wins the Nassau`,
    subhead: top.display,
    winners,
    standings: c.standings,
    lines: summary,
  }
}

export const nassauGame: GolfGame = {
  meta: {
    id: 'nassau',
    name: 'Nassau',
    emoji: '🇺🇸',
    tagline: 'Three matches in one round: front nine, back nine and overall.',
    playersLabel: '2–4 Players',
    minPlayers: 2,
    maxPlayers: 4,
    bestFor: '2 or 4 golfers',
    complexity: 3,
    strategy: 3,
    complexityLabel: 'Medium',
    strategyLabel: 'Medium',
    swing: 'Medium',
    accent: 'nassau',
  },
  settings: nassauSettings,
  defaultSettings: () => defaultsFrom(nassauSettings),
  validatePlayers: (n) => (n < 2 ? 'Nassau needs at least 2 players.' : n > 4 ? 'This app supports up to 4 players.' : null),
  createRoundState: (ctx) => ({
    teams: ctx.players.length === 4 ? [ctx.players.slice(0, 2).map((p) => p.id), ctx.players.slice(2, 4).map((p) => p.id)] : undefined,
    presses: [] as PressRecord[],
  }),
  compute,
  finalResult,
  explain,
  preScoreStage: null,
}
