/**
 * Scoring helpers shared by every game module.
 */

import { holeByNumber } from './course'
import { netScore, playingHandicaps, type HandicapOptions, type NetContext } from './handicap'
import type {
  GameContext,
  HoleEntry,
  Player,
  PlayerId,
  SettingsValues,
  StandingRow,
} from './types'

/** Builds the net-scoring context from whatever settings the game declared. */
export function netContextFrom(ctx: GameContext, defaultAllowance = 100): NetContext {
  const s: SettingsValues = ctx.settings
  const opts: HandicapOptions = {
    enabled: !!s.handicapEnabled && s.scoring === 'net',
    allowancePct: Number(s.handicapAllowance ?? defaultAllowance),
    mode: (s.handicapMode as 'difference' | 'full') ?? 'difference',
  }
  return {
    handicaps: playingHandicaps(ctx.players, ctx.course, opts),
    course: ctx.course,
    useNet: opts.enabled,
  }
}

/** Effective (net or gross) score for every player on one hole. */
export function effectiveScores(
  ctx: GameContext,
  net: NetContext,
  entry: HoleEntry,
): Record<PlayerId, number | null> {
  const hole = holeByNumber(ctx.course, entry.hole)
  const out: Record<PlayerId, number | null> = {}
  for (const p of ctx.players) out[p.id] = netScore(net, p.id, hole, entry.scores[p.id] ?? null)
  return out
}

export function hasAllScores(ctx: GameContext, entry: HoleEntry | undefined): boolean {
  if (!entry) return false
  return ctx.players.every((p) => typeof entry.scores[p.id] === 'number')
}

/** Lowest value in a map, ignoring nulls. Returns null when nothing is entered. */
export function lowestOf(scores: (number | null)[]): number | null {
  const vals = scores.filter((v): v is number => typeof v === 'number')
  if (!vals.length) return null
  return Math.min(...vals)
}

export function playersWithLowest(scores: Record<PlayerId, number | null>): PlayerId[] {
  const low = lowestOf(Object.values(scores))
  if (low == null) return []
  return Object.keys(scores).filter((id) => scores[id] === low)
}

/** Best (lowest) score of a team; null when nobody on the team has a score. */
export function bestBall(scores: Record<PlayerId, number | null>, team: PlayerId[]): number | null {
  return lowestOf(team.map((id) => scores[id] ?? null))
}

export function nameOf(players: Player[], id: PlayerId): string {
  return players.find((p) => p.id === id)?.name ?? '—'
}

export function namesOf(players: Player[], ids: PlayerId[]): string {
  return ids.map((id) => nameOf(players, id)).join(' + ')
}

/**
 * Ranks players by value. `higherIsBetter` chooses the direction.
 * Ties share a rank (1, 1, 3, 4) which is what a golfer expects to see.
 */
export function rankRows(
  rows: Omit<StandingRow, 'rank'>[],
  higherIsBetter = true,
): StandingRow[] {
  const sorted = [...rows].sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value))
  let lastValue: number | null = null
  let lastRank = 0
  return sorted.map((r, i) => {
    const rank = lastValue !== null && r.value === lastValue ? lastRank : i + 1
    lastValue = r.value
    lastRank = rank
    return { ...r, rank }
  })
}

/**
 * Movement arrows: compares each player's rank now with their rank after the
 * previous completed hole. Positive = climbed the board.
 */
export function withMovement(current: StandingRow[], previous: StandingRow[]): StandingRow[] {
  const before = new Map(previous.map((r) => [r.playerId, r.rank]))
  return current.map((r) => {
    const was = before.get(r.playerId)
    return { ...r, movement: was == null ? 0 : was - r.rank }
  })
}

export function completedEntries(entries: HoleEntry[]): HoleEntry[] {
  return entries.filter((e) => e.complete)
}

export function sumPoints(outcomePoints: Record<PlayerId, number>[], players: Player[]): Record<PlayerId, number> {
  const total: Record<PlayerId, number> = {}
  for (const p of players) total[p.id] = 0
  for (const pts of outcomePoints) {
    for (const [id, v] of Object.entries(pts)) total[id] = (total[id] ?? 0) + v
  }
  return total
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

/** Round to 2dp without float dust — points can be fractional (split skins). */
export function tidy(n: number): number {
  return Math.round(n * 100) / 100
}

/** "+4", "E", "-2" against par for the holes played so far, per player. */
export function toParTotal(ctx: GameContext, entries: HoleEntry[]): Record<PlayerId, string> {
  const out: Record<PlayerId, string> = {}
  for (const p of ctx.players) {
    let strokes = 0
    let par = 0
    let counted = 0
    for (const e of entries) {
      const s = e.scores[p.id]
      if (typeof s !== 'number') continue
      strokes += s
      par += holeByNumber(ctx.course, e.hole).par
      counted += 1
    }
    if (!counted) {
      out[p.id] = ''
      continue
    }
    const d = strokes - par
    out[p.id] = `${strokes} (${d === 0 ? 'E' : d > 0 ? `+${d}` : d})`
  }
  return out
}
