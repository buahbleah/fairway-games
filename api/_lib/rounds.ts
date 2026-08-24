import { sql } from './db'
import { HttpError } from './http'
import type { SessionUser } from './auth'

/**
 * The wire shape of a round. Deliberately the same shape the offline client
 * already uses, so the sync layer is a copy rather than a translation.
 */
export interface RoundDoc {
  id: string
  leagueId: string | null
  hostId: string
  gameId: string
  title: string | null
  status: 'active' | 'finished'
  settings: Record<string, any>
  course: Record<string, any>
  gameState: Record<string, any>
  currentHole: number
  version: number
  createdAt: string
  updatedAt: string
  players: {
    id: string
    userId: string | null
    name: string
    handicapIndex: number | null
    colorIndex: number
  }[]
  entries: {
    hole: number
    scores: Record<string, number | null>
    game: Record<string, any>
    complete: boolean
  }[]
}

/**
 * You may see a round if you host it, play in it, or belong to its league.
 * Returns the round row; throws 403/404 otherwise.
 */
export async function assertAccess(roundId: string, user: SessionUser): Promise<any> {
  const rows = (await sql`
    SELECT r.*,
      (r.host_id = ${user.id}) AS is_host,
      EXISTS (SELECT 1 FROM round_players p WHERE p.round_id = r.id AND p.user_id = ${user.id}) AS is_player,
      EXISTS (
        SELECT 1 FROM league_members m
        WHERE m.league_id = r.league_id AND m.user_id = ${user.id}
      ) AS in_league
    FROM rounds r WHERE r.id = ${roundId}::uuid
  `) as any[]

  const round = rows[0]
  if (!round) throw new HttpError(404, 'That round does not exist.')
  if (!round.is_host && !round.is_player && !round.in_league) {
    throw new HttpError(403, 'You are not in that round.')
  }
  return round
}

export async function loadRound(roundId: string): Promise<RoundDoc> {
  const rows = (await sql`SELECT * FROM rounds WHERE id = ${roundId}::uuid`) as any[]
  const r = rows[0]
  if (!r) throw new HttpError(404, 'That round does not exist.')

  const players = (await sql`
    SELECT player_id, user_id, name, handicap_index, color_index
    FROM round_players WHERE round_id = ${roundId}::uuid ORDER BY seat
  `) as any[]

  const entries = (await sql`
    SELECT hole, scores, game, complete
    FROM hole_entries WHERE round_id = ${roundId}::uuid ORDER BY hole
  `) as any[]

  return {
    id: r.id,
    leagueId: r.league_id,
    hostId: r.host_id,
    gameId: r.game_id,
    title: r.title,
    status: r.status,
    settings: r.settings ?? {},
    course: r.course ?? {},
    gameState: r.game_state ?? {},
    currentHole: r.current_hole,
    version: Number(r.version),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    players: players.map((p) => ({
      id: p.player_id,
      userId: p.user_id,
      name: p.name,
      handicapIndex: p.handicap_index === null ? null : Number(p.handicap_index),
      colorIndex: p.color_index,
    })),
    entries: entries.map((e) => ({
      hole: e.hole,
      scores: e.scores ?? {},
      game: e.game ?? {},
      complete: e.complete,
    })),
  }
}

/** Cheap check used by the polling loop — one row, no joins. */
export async function roundVersion(roundId: string): Promise<number> {
  const rows = (await sql`SELECT version FROM rounds WHERE id = ${roundId}::uuid`) as any[]
  if (!rows[0]) throw new HttpError(404, 'That round does not exist.')
  return Number(rows[0].version)
}
