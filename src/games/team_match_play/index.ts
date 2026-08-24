/**
 * TEAM MATCH PLAY
 *
 * Two pairs, hole by hole. Win a hole and you go one up. No stroke totals, no
 * running score — just up, down or all square, and a match that can finish
 * before the 18th.
 */

import {
  bestBall,
  completedEntries,
  effectiveScores,
  namesOf,
  netContextFrom,
  rankRows,
  tidy,
} from '../../core/scoring'
import {
  choice,
  defaultsFrom,
  grossNetSetting,
  handicapSettings,
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

export type Side = 'A' | 'B'

const FORMAT = 'Format'
const RULES = 'Match rules'

export const teamMatchSettings: SettingDef[] = [
  choice('format', 'Format', 'fourball', [
    { value: 'fourball', label: 'Four-Ball', help: 'Everyone plays their own ball. The better score of each pair counts.' },
    { value: 'foursomes', label: 'Foursomes', help: 'Alternate shot — one ball per team, hit in turn.' },
    { value: 'scramble', label: 'Scramble', help: 'Both hit, the team plays the better shot, one score per team.' },
  ], { group: FORMAT }),
  choice('teamRotation', 'Teams', 'fixed', [
    { value: 'fixed', label: 'Same all round' },
    { value: 'six', label: 'Rotate every 6 holes', help: 'Everyone partners everyone — three mini matches in one round.' },
  ], { group: FORMAT }),
  choice('ties', 'A tied hole is', 'halved', [
    { value: 'halved', label: 'Halved', help: 'The standard. Nothing changes.' },
    { value: 'carry', label: 'Carried', help: 'The hole rides on to the next one, which is then worth two.' },
  ], { group: RULES }),
  toggle('concessions', 'Concessions', true, {
    group: RULES,
    help: 'Allow a hole or the whole match to be given to the other side.',
  }),
  choice('extraHoles', 'If the match is level after 18', 'tied', [
    { value: 'tied', label: 'Match is halved', help: 'Shake hands and call it even.' },
    { value: 'sudden', label: 'Sudden death', help: 'Keep going until a hole is won.' },
  ], { group: RULES }),
  num('matchValue', 'The match is worth', 1, {
    group: 'Stakes', min: 0, max: 100, presets: [1, 2, 5, 10], suffix: 'pts',
    help: 'Points to each player on the winning team.',
  }),
  num('holeValue', 'Bonus per hole won', 0, {
    group: 'Stakes', min: 0, max: 20, suffix: 'pts', advanced: true,
    help: 'Optional. Some groups also pay for each hole won on top of the match.',
  }),
  grossNetSetting(),
  ...handicapSettings(
    90,
    'Four-Ball match play is 90% of course handicap off the lowest player. Foursomes is 50% of the combined difference. Change it if your group plays differently.',
  ),
  pointValueSetting(),
]

/* -------------------------------------------------------------------- teams */

export function teamsForHole(ctx: GameContext, hole: number): [PlayerId[], PlayerId[]] {
  const ids = ctx.players.map((p) => p.id)
  if (ctx.settings.teamRotation === 'six' && ids.length === 4) {
    const block = Math.floor((hole - 1) / 6) % 3
    const [a, b, c, d] = ids
    return ([
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]],
    ] as [PlayerId[], PlayerId[]][])[block]
  }
  const teams = ctx.gameState.teams as PlayerId[][] | undefined
  if (teams && teams.length === 2) return [teams[0], teams[1]]
  const half = Math.ceil(ids.length / 2)
  return [ids.slice(0, half), ids.slice(half)]
}

export function teamNames(ctx: GameContext): [string, string] {
  const names = ctx.gameState.teamNames as string[] | undefined
  return [names?.[0] || 'Team Green', names?.[1] || 'Team Sand']
}

/* ------------------------------------------------------------ match status */

export interface MatchState {
  /** Positive = team A up by that many holes. */
  diff: number
  holesPlayed: number
  holesRemaining: number
  decided: boolean
  winner: Side | null
  /** "2 UP", "AS", "4 & 3", "1 up". */
  status: string
  dormie: boolean
  /** Holes won by each side. */
  won: [number, number]
  halved: number
  /** Set when extra holes are being played. */
  suddenDeath: boolean
}

export function formatMatchResult(diff: number, holesRemaining: number, finished: boolean): string {
  const lead = Math.abs(diff)
  if (lead === 0) return finished ? 'Halved' : 'AS'
  if (!finished) return `${lead} UP`
  // Closed out early: "4 & 3". Finished on the last hole: "2 up" / "1 up".
  return holesRemaining > 0 ? `${lead} & ${holesRemaining}` : `${lead} up`
}

/* ---------------------------------------------------------------- compute */

function holeWinner(ctx: GameContext, entry: HoleEntry, teams: [PlayerId[], PlayerId[]]): Side | null | 'pending' {
  const conceded = entry.game?.conceded as Side | undefined
  if (conceded) return conceded === 'A' ? 'B' : 'A'

  const net = netContextFrom(ctx, 90)
  const scores = effectiveScores(ctx, net, entry)
  const single = ctx.settings.format !== 'fourball'
  const a = single ? (scores[teams[0][0]] ?? null) : bestBall(scores, teams[0])
  const b = single ? (scores[teams[1][0]] ?? null) : bestBall(scores, teams[1])
  if (a == null || b == null) return 'pending'
  if (a === b) return null
  return a < b ? 'A' : 'B'
}

function compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound {
  const holes = ctx.course.holes.map((h) => h.number)
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)
  const [nameA, nameB] = teamNames(ctx)
  const matchValue = Number(ctx.settings.matchValue ?? 1)
  const holeValue = Number(ctx.settings.holeValue ?? 0)
  const carryTies = ctx.settings.ties === 'carry'

  const outcomes: HoleOutcome[] = []
  let diff = 0
  let carry = 0
  const won: [number, number] = [0, 0]
  let halved = 0
  let decidedAtHole: number | null = null
  let matchConcededBy: Side | null = (ctx.gameState.matchConcededBy as Side) ?? null

  for (const e of done) {
    const teams = teamsForHole(ctx, e.hole)
    const points: Record<PlayerId, number> = Object.fromEntries(ctx.players.map((p) => [p.id, 0]))
    const result = holeWinner(ctx, e, teams)

    if (result === 'pending') {
      outcomes.push({ hole: e.hole, points, headline: 'Waiting for scores', pending: true })
      continue
    }

    const worth = 1 + carry
    let headline: string
    const detail: string[] = []

    if (result === null) {
      halved += 1
      if (carryTies) {
        carry += 1
        headline = `Hole halved — carried to hole ${e.hole + 1}`
      } else {
        headline = 'Hole halved'
      }
    } else {
      const idx = result === 'A' ? 0 : 1
      won[idx] += worth
      diff += result === 'A' ? worth : -worth
      carry = 0
      const label = result === 'A' ? nameA : nameB
      headline = `${label} win the hole${worth > 1 ? ` (worth ${worth})` : ''}`
      detail.push(namesOf(ctx.players, teams[idx]))
      if (holeValue) for (const id of teams[idx]) points[id] += holeValue * worth
    }

    const played = holes.filter((h) => h <= e.hole).length
    const remaining = holes.length - played
    if (decidedAtHole == null && Math.abs(diff) > remaining) {
      decidedAtHole = e.hole
      const winnerSide: Side = diff > 0 ? 'A' : 'B'
      const winnerTeam = teamsForHole(ctx, e.hole)[winnerSide === 'A' ? 0 : 1]
      for (const id of winnerTeam) points[id] += matchValue
      detail.push(`Match won ${formatMatchResult(diff, remaining, true)}`)
    }

    outcomes.push({ hole: e.hole, points, headline, detail })
  }

  const playedHoles = done.length
  const remaining = Math.max(0, holes.length - playedHoles)
  const allPlayed = remaining === 0
  let decided = decidedAtHole != null || allPlayed || matchConcededBy != null
  let winner: Side | null = matchConcededBy ? (matchConcededBy === 'A' ? 'B' : 'A') : diff > 0 ? 'A' : diff < 0 ? 'B' : null

  // Level after 18 with sudden death on: the match keeps going.
  const suddenDeath = allPlayed && diff === 0 && ctx.settings.extraHoles === 'sudden' && !matchConcededBy
  if (suddenDeath) {
    decided = false
    winner = null
  }
  if (allPlayed && diff === 0 && !suddenDeath) winner = null

  // Award the match on the final hole if it ran the distance.
  if (decided && winner && decidedAtHole == null && outcomes.length) {
    const last = outcomes[outcomes.length - 1]
    const winnerTeam = teamsForHole(ctx, last.hole)[winner === 'A' ? 0 : 1]
    for (const id of winnerTeam) last.points[id] = (last.points[id] ?? 0) + matchValue
  }

  const state: MatchState = {
    diff,
    holesPlayed: playedHoles,
    holesRemaining: remaining,
    decided,
    winner,
    status: formatMatchResult(diff, decidedAtHole != null ? holes.length - playedHoles : remaining, decided),
    dormie: !decided && Math.abs(diff) > 0 && Math.abs(diff) === remaining,
    won,
    halved,
    suddenDeath,
  }

  const totals: Record<PlayerId, number> = Object.fromEntries(ctx.players.map((p) => [p.id, 0]))
  for (const o of outcomes) for (const [id, v] of Object.entries(o.points)) totals[id] += v

  const teams = teamsForHole(ctx, Math.min(playedHoles + 1, holes[holes.length - 1]))
  // Match play has no running total to rank on, so the board ranks by how far
  // each player's side is up. Points won only settle at the end.
  const standings = rankRows(
    ctx.players.map((p) => {
      const side: Side = teams[0].includes(p.id) ? 'A' : 'B'
      const sideDiff = side === 'A' ? diff : -diff
      const points = tidy(totals[p.id] ?? 0)
      return {
        playerId: p.id,
        value: sideDiff,
        display: sideDiff === 0 ? 'AS' : sideDiff > 0 ? `${sideDiff} UP` : `${-sideDiff} DN`,
        sub: `${side === 'A' ? nameA : nameB}${points ? ` · ${points} pts` : ''}`,
      }
    }),
    true,
  )

  // The match state is drawn in full by the Team Match HUD.
  const status: StatusChip[] = []
  if (state.won[0] + state.won[1] + state.halved > 0) {
    status.push({
      label: 'Holes',
      value: `${state.won[0]}–${state.won[1]}${state.halved ? ` · ${state.halved} halved` : ''}`,
      tone: 'neutral',
    })
  }

  return {
    outcomes,
    standings,
    status,
    closedOut: decidedAtHole != null,
    teams: [
      { id: 'A', name: nameA, playerIds: teams[0], colorKey: 'green' },
      { id: 'B', name: nameB, playerIds: teams[1], colorKey: 'sand' },
    ],
    extra: { match: state, nameA, nameB },
  }
}

function explain(s: SettingsValues): RulesDoc {
  const fmt = {
    fourball: 'Four-Ball: everybody plays their own ball and the better score of each pair counts on every hole.',
    foursomes: 'Foursomes, or alternate shot: one ball per team, partners hitting in turn. One score per team.',
    scramble: 'Scramble: both partners hit, the team then plays the better shot. One score per team.',
  }[(s.format as string)] ?? 'Four-Ball: the better score of each pair counts.'

  return {
    summary:
      'Two teams of two, hole by hole. Win a hole and your team goes one up. The size of the win does not matter — a 4 beating a 9 is worth exactly the same as a 4 beating a 5.',
    sections: [
      { title: 'The format', body: [fmt, 'Each hole is its own contest. Lowest team score wins it.'] },
      {
        title: 'Reading the match',
        body: [
          'Level is ALL SQUARE, shown as AS.',
          'One hole ahead is 1 UP. Two ahead is 2 UP, and so on.',
          'Ahead by exactly as many holes as are left is DORMIE — from there the leading team cannot lose.',
          'The match ends the moment one team is up by more holes than remain.',
        ],
      },
      {
        title: 'How results are written',
        body: [
          '3 & 2 means three holes up with two to play — the match finished on the 16th.',
          '1 up means it went all the way to the 18th and was won by a single hole.',
          s.extraHoles === 'sudden'
            ? 'Level after 18 goes to sudden death: play on until a hole is won.'
            : 'Level after 18 is a halved match.',
        ],
      },
      ...(s.concessions
        ? [
            {
              title: 'Concessions',
              body: [
                'A hole can be conceded when it is clearly gone — no need to hole out.',
                'A whole match can be conceded too. That is normal golf etiquette, not giving up.',
              ],
            },
          ]
        : []),
    ],
    example: {
      title: 'Hole 8 · Four-Ball',
      rows: [
        { label: 'Marc', value: '4', emphasis: true },
        { label: 'Phil', value: '6' },
        { label: 'Team Green counts', value: '4', emphasis: true },
        { label: 'Mike', value: '5' },
        { label: 'John', value: '5' },
        { label: 'Team Sand counts', value: '5', emphasis: true },
      ],
      result: 'Team Green win the hole · 1 UP',
    },
    variations: [
      { name: 'Four-Ball', text: 'Better ball of the pair. The most common team match.', active: s.format === 'fourball' },
      { name: 'Foursomes', text: 'Alternate shot. Fast, and a real test of a partnership.', active: s.format === 'foursomes' },
      { name: 'Scramble', text: 'Both play, best shot counts. Friendly to higher handicaps.', active: s.format === 'scramble' },
      { name: 'Rotating partners', text: 'Change pairs every six holes — often called Sixes or Round Robin.', active: s.teamRotation === 'six' },
      { name: 'Carry-over halves', text: 'A halved hole rides on to the next.', active: s.ties === 'carry' },
      { name: 'Sudden death', text: 'Extra holes rather than a halved match.', active: s.extraHoles === 'sudden' },
    ],
    definitions: [
      { term: 'AS', text: 'All square. The match is level.' },
      { term: 'Dormie', text: 'Up by exactly the number of holes left.' },
      { term: '4 & 3', text: 'Four up with three to play. The match is over.' },
      { term: 'Halved', text: 'A tied hole, or a tied match.' },
      { term: 'Concede', text: 'Giving a hole, a putt or the match to the opposition.' },
    ],
  }
}

function finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult {
  const c = compute(ctx, entries)
  const state = c.extra?.match as MatchState
  const [nameA, nameB] = teamNames(ctx)
  const teams = teamsForHole(ctx, 1)
  const winnerTeam = state.winner === 'A' ? teams[0] : state.winner === 'B' ? teams[1] : []
  const label = state.winner === 'A' ? nameA : state.winner === 'B' ? nameB : null

  return {
    headline: label ? `${label} win` : 'Match halved',
    subhead: state.winner ? state.status : `${state.holesPlayed} holes, all square`,
    winners: winnerTeam,
    standings: c.standings,
    lines: [
      `${nameA} won ${state.won[0]} hole${state.won[0] === 1 ? '' : 's'}`,
      `${nameB} won ${state.won[1]} hole${state.won[1] === 1 ? '' : 's'}`,
      `${state.halved} halved`,
    ],
  }
}

export const teamMatchGame: GolfGame = {
  meta: {
    id: 'team_match_play',
    name: 'Team Match',
    emoji: '⚔️',
    tagline: 'Two teams battle hole by hole.',
    playersLabel: '4 Players',
    minPlayers: 4,
    maxPlayers: 4,
    bestFor: '4 golfers',
    complexity: 1,
    strategy: 4,
    complexityLabel: 'Easy',
    strategyLabel: 'High',
    swing: 'Low',
    accent: 'match',
  },
  settings: teamMatchSettings,
  defaultSettings: () => defaultsFrom(teamMatchSettings),
  validatePlayers: (n) => (n !== 4 ? 'Team Match Play is built for 4 players — two teams of two.' : null),
  createRoundState: (ctx: { players: Player[] }) => ({
    teams: [ctx.players.slice(0, 2).map((p) => p.id), ctx.players.slice(2, 4).map((p) => p.id)],
    teamNames: ['Team Green', 'Team Sand'],
  }),
  compute,
  finalResult,
  explain,
  preScoreStage: 'teams',
}
