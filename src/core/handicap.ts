/**
 * Handicap maths.
 *
 * The numbers here are not invented. They follow the World Handicap System
 * formulas and the USGA/R&A "Handicap Allowance" recommendations, and every
 * allowance we ship is shown to the golfer with its name and percentage so
 * nobody has to trust a hardcoded number. All of them are configurable.
 *
 *   Course Handicap  = Handicap Index x (Slope / 113) + (Course Rating - Par)
 *   Playing Handicap = Course Handicap x Allowance
 *
 * Recommended allowances (WHS Appendix C):
 *   Individual match play ............ 100%  (low player to scratch)
 *   Four-Ball match play .............  90%  (from the lowest of the four)
 *   Foursomes (alternate shot) match .  50%  (of the combined difference)
 *   Individual stroke play ...........  95%
 *   Four-Ball stroke play ............  85%
 *   Scramble, 4 players ..............  25 / 20 / 15 / 10%
 */

import type { Course, Hole, Player, PlayerId } from './types'

export const ALLOWANCES = {
  matchIndividual: { pct: 100, label: 'Individual match play — 100%' },
  fourBallMatch: { pct: 90, label: 'Four-Ball match play — 90%' },
  foursomesMatch: { pct: 50, label: 'Foursomes / alternate shot — 50%' },
  strokeIndividual: { pct: 95, label: 'Individual stroke play — 95%' },
  fourBallStroke: { pct: 85, label: 'Four-Ball stroke play — 85%' },
  full: { pct: 100, label: 'Full handicap — 100%' },
} as const

export function coursePar(course: Course): number {
  return course.holes.reduce((t, h) => t + h.par, 0)
}

/** Course Handicap, rounded to the nearest whole stroke (WHS). */
export function courseHandicap(player: Player, course: Course): number {
  if (player.handicapIndex == null) return 0
  const slope = course.slopeRating ?? 113
  const rating = course.courseRating ?? coursePar(course)
  const raw = player.handicapIndex * (slope / 113) + (rating - coursePar(course))
  // A 9-hole set of holes gets half the strokes.
  const scale = course.holes.length === 9 ? 0.5 : 1
  return Math.round(raw * scale)
}

export interface HandicapOptions {
  enabled: boolean
  /** Percentage of Course Handicap actually used, e.g. 90 for Four-Ball. */
  allowancePct: number
  /**
   * 'difference' drops everyone by the lowest playing handicap so the best
   * player plays off scratch — the standard for match-play formats.
   * 'full' gives every player their whole allocation.
   */
  mode: 'difference' | 'full'
}

export const NO_HANDICAP: HandicapOptions = { enabled: false, allowancePct: 100, mode: 'difference' }

/** Playing handicaps for every player, after allowance and difference mode. */
export function playingHandicaps(
  players: Player[],
  course: Course,
  opts: HandicapOptions,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {}
  if (!opts.enabled) {
    for (const p of players) out[p.id] = 0
    return out
  }
  const raw = players.map((p) => Math.round((courseHandicap(p, course) * opts.allowancePct) / 100))
  const base = opts.mode === 'difference' ? Math.min(...raw) : 0
  players.forEach((p, i) => {
    out[p.id] = raw[i] - base
  })
  return out
}

/**
 * Strokes a player receives on one hole.
 * Holes are ranked by stroke index across the holes actually being played, so
 * this stays correct for 9-hole rounds and odd course cards.
 */
export function strokesOnHole(playingHandicap: number, hole: Hole, holes: Hole[]): number {
  const n = holes.length
  if (n === 0) return 0
  const ranked = [...holes].sort((a, b) => a.strokeIndex - b.strokeIndex)
  const rank = ranked.findIndex((h) => h.number === hole.number) + 1
  if (rank === 0) return 0

  if (playingHandicap >= 0) {
    const base = Math.floor(playingHandicap / n)
    const extra = playingHandicap % n
    return base + (rank <= extra ? 1 : 0)
  }
  // Plus handicaps give strokes back, starting on the easiest holes.
  const a = -playingHandicap
  const base = Math.floor(a / n)
  const extra = a % n
  const reverseRank = n - rank + 1
  // `|| 0` keeps a plus handicap from producing -0, which reads oddly everywhere.
  return -(base + (reverseRank <= extra ? 1 : 0)) || 0
}

export interface NetContext {
  handicaps: Record<PlayerId, number>
  course: Course
  useNet: boolean
}

/** Net score for a player on a hole; returns null when no score was entered. */
export function netScore(
  ctx: NetContext,
  playerId: PlayerId,
  hole: Hole,
  gross: number | null,
): number | null {
  if (gross == null) return null
  if (!ctx.useNet) return gross
  return gross - strokesOnHole(ctx.handicaps[playerId] ?? 0, hole, ctx.course.holes)
}

/** Convenience: strokes received table for a scorecard view. */
export function strokeTable(
  handicaps: Record<PlayerId, number>,
  course: Course,
): Record<PlayerId, Record<number, number>> {
  const out: Record<PlayerId, Record<number, number>> = {}
  for (const id of Object.keys(handicaps)) {
    out[id] = {}
    for (const h of course.holes) out[id][h.number] = strokesOnHole(handicaps[id], h, course.holes)
  }
  return out
}
