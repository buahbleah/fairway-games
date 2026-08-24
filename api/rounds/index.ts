import { sql } from '../_lib/db.js'
import { body, handler, HttpError, json, requireString } from '../_lib/http.js'
import { requireUser } from '../_lib/auth.js'
import { loadRound } from '../_lib/rounds.js'

/**
 * GET  — every round you can see: hosted, played in, or in one of your leagues.
 * POST — start an online round. The players array carries both real accounts
 *        (by userId) and guests, so a group can start playing before everyone
 *        has signed up.
 */
export default handler(['GET', 'POST'], async (req, res) => {
  const user = await requireUser(req)

  if (req.method === 'GET') {
    const rows = (await sql`
      SELECT DISTINCT r.id, r.game_id, r.title, r.status, r.league_id, r.host_id,
             r.current_hole, r.created_at, r.updated_at, r.version,
             l.name AS league_name,
             (SELECT count(*) FROM hole_entries h WHERE h.round_id = r.id AND h.complete) AS holes_played
      FROM rounds r
      LEFT JOIN leagues l ON l.id = r.league_id
      LEFT JOIN round_players p ON p.round_id = r.id
      LEFT JOIN league_members m ON m.league_id = r.league_id
      WHERE r.host_id = ${user.id} OR p.user_id = ${user.id} OR m.user_id = ${user.id}
      ORDER BY r.updated_at DESC
      LIMIT 50
    `) as any[]

    const ids = rows.map((r) => r.id)
    const players = ids.length
      ? ((await sql`
          SELECT round_id, player_id, user_id, name, color_index, handicap_index, avatar_url
          FROM round_players WHERE round_id = ANY(${ids}::uuid[]) ORDER BY seat
        `) as any[])
      : []

    json(res, 200, {
      rounds: rows.map((r) => ({
        id: r.id,
        gameId: r.game_id,
        title: r.title,
        status: r.status,
        leagueId: r.league_id,
        leagueName: r.league_name,
        isHost: r.host_id === user.id,
        currentHole: r.current_hole,
        holesPlayed: Number(r.holes_played),
        version: Number(r.version),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        players: players
          .filter((p) => p.round_id === r.id)
          .map((p) => ({
            id: p.player_id,
            userId: p.user_id,
            name: p.name,
            handicapIndex: p.handicap_index === null ? null : Number(p.handicap_index),
            colorIndex: p.color_index,
            avatarUrl: p.avatar_url ?? null,
          })),
      })),
    })
    return
  }

  const input = body(req)
  const gameId = requireString(input.gameId, 'Game', 40)
  const players = Array.isArray(input.players) ? input.players : []
  if (players.length < 2) throw new HttpError(400, 'A round needs at least two players.')
  if (players.length > 4) throw new HttpError(400, 'This app supports up to four players.')

  const leagueId = typeof input.leagueId === 'string' && input.leagueId ? input.leagueId : null
  if (leagueId) {
    const member = (await sql`
      SELECT 1 FROM league_members WHERE league_id = ${leagueId}::uuid AND user_id = ${user.id}
    `) as any[]
    if (!member.length) throw new HttpError(403, 'You are not a member of that league.')
  }

  const rows = (await sql`
    INSERT INTO rounds (league_id, host_id, game_id, title, settings, course, game_state, current_hole)
    VALUES (
      ${leagueId}, ${user.id}, ${gameId}, ${input.title ?? null},
      ${JSON.stringify(input.settings ?? {})}::jsonb,
      ${JSON.stringify(input.course ?? {})}::jsonb,
      ${JSON.stringify(input.gameState ?? {})}::jsonb,
      ${Number(input.currentHole) || 1}
    )
    RETURNING id
  `) as any[]
  const roundId = rows[0].id

  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const handicap =
      p.handicapIndex === null || p.handicapIndex === undefined || p.handicapIndex === ''
        ? null
        : Number(p.handicapIndex)
    await sql`
      INSERT INTO round_players (round_id, player_id, user_id, name, handicap_index, color_index, seat, avatar_url)
      VALUES (
        ${roundId}, ${requireString(p.id, 'Player id', 64)}, ${p.userId ?? null},
        ${requireString(p.name, 'Player name', 60)}, ${handicap},
        ${Number(p.colorIndex) || 0}, ${i},
        ${typeof p.avatarUrl === 'string' && p.avatarUrl.startsWith('data:image/') ? p.avatarUrl : null}
      )
    `
  }

  json(res, 201, { round: await loadRound(roundId) })
})
