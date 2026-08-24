import { sql } from '../_lib/db.js'
import { handler, HttpError, json, param } from '../_lib/http.js'
import { requireUser } from '../_lib/auth.js'

/**
 * One league: its members, and every round ever played in it with the finishing
 * order. This is the "past games listed with all group participants" view.
 */
export default handler(['GET'], async (req, res) => {
  const user = await requireUser(req)
  const id = param(req, 'id')

  const membership = (await sql`
    SELECT role FROM league_members WHERE league_id = ${id}::uuid AND user_id = ${user.id}
  `) as any[]
  if (!membership.length) throw new HttpError(403, 'You are not a member of that league.')

  const leagueRows = (await sql`
    SELECT id, name, description, join_code, owner_id, created_at FROM leagues WHERE id = ${id}::uuid
  `) as any[]
  const league = leagueRows[0]
  if (!league) throw new HttpError(404, 'League not found.')

  const members = (await sql`
    SELECT u.id, u.name, u.email, u.handicap_index, u.color_index, lm.role, lm.joined_at
    FROM league_members lm
    JOIN users u ON u.id = lm.user_id
    WHERE lm.league_id = ${id}::uuid
    ORDER BY lm.role = 'owner' DESC, u.name
  `) as any[]

  const rounds = (await sql`
    SELECT r.id, r.game_id, r.title, r.status, r.created_at, r.updated_at, r.current_hole,
           (SELECT count(*) FROM hole_entries h WHERE h.round_id = r.id AND h.complete) AS holes_played
    FROM rounds r
    WHERE r.league_id = ${id}::uuid
    ORDER BY r.created_at DESC
    LIMIT 100
  `) as any[]

  const roundIds = rounds.map((r) => r.id)
  const players = roundIds.length
    ? ((await sql`
        SELECT round_id, player_id, user_id, name, handicap_index, color_index, seat
        FROM round_players WHERE round_id = ANY(${roundIds}::uuid[])
        ORDER BY seat
      `) as any[])
    : []

  json(res, 200, {
    league: {
      id: league.id,
      name: league.name,
      description: league.description,
      joinCode: league.join_code,
      isOwner: league.owner_id === user.id,
      createdAt: league.created_at,
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      handicapIndex: m.handicap_index === null ? null : Number(m.handicap_index),
      colorIndex: m.color_index,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    rounds: rounds.map((r) => ({
      id: r.id,
      gameId: r.game_id,
      title: r.title,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      currentHole: r.current_hole,
      holesPlayed: Number(r.holes_played),
      players: players
        .filter((p) => p.round_id === r.id)
        .map((p) => ({
          id: p.player_id,
          userId: p.user_id,
          name: p.name,
          handicapIndex: p.handicap_index === null ? null : Number(p.handicap_index),
          colorIndex: p.color_index,
        })),
    })),
  })
})
