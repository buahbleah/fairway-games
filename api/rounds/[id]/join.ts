import { sql } from '../../_lib/db.js'
import { handler, HttpError, json, param } from '../../_lib/http.js'
import { requireUser } from '../../_lib/auth.js'
import { loadRound } from '../../_lib/rounds.js'

/**
 * Accept an invitation and take a seat. Also works for anyone in the round's
 * league, so a league round can be joined without a personal invite.
 */
export default handler(['POST'], async (req, res) => {
  const user = await requireUser(req)
  const id = param(req, 'id')
  const email = user.email.toLowerCase()

  const rows = (await sql`
    SELECT r.id, r.status, r.league_id,
      EXISTS (SELECT 1 FROM round_invites i
              WHERE i.round_id = r.id AND lower(i.email) = ${email} AND i.status <> 'declined') AS invited,
      EXISTS (SELECT 1 FROM league_members m
              WHERE m.league_id = r.league_id AND m.user_id = ${user.id}) AS in_league,
      EXISTS (SELECT 1 FROM round_players p
              WHERE p.round_id = r.id AND p.user_id = ${user.id}) AS seated
    FROM rounds r WHERE r.id = ${id}::uuid
  `) as any[]

  const round = rows[0]
  if (!round) throw new HttpError(404, 'That round does not exist.')
  if (!round.invited && !round.in_league) throw new HttpError(403, 'You have not been invited to that round.')

  if (!round.seated) {
    const openSeat = (await sql`
      SELECT player_id FROM round_players
      WHERE round_id = ${id}::uuid AND user_id IS NULL ORDER BY seat LIMIT 1
    `) as any[]

    if (openSeat.length) {
      await sql`
        UPDATE round_players SET user_id = ${user.id}, name = ${user.name},
               handicap_index = COALESCE(${user.handicapIndex}, handicap_index),
               color_index = ${user.colorIndex}, avatar_url = ${user.avatarUrl}
        WHERE round_id = ${id}::uuid AND player_id = ${openSeat[0].player_id}
      `
    } else {
      const count = (await sql`
        SELECT count(*)::int AS n FROM round_players WHERE round_id = ${id}::uuid
      `) as any[]
      if (count[0].n >= 4) throw new HttpError(409, 'That round is already full.')
      await sql`
        INSERT INTO round_players (round_id, player_id, user_id, name, handicap_index, color_index, seat, avatar_url)
        VALUES (${id}::uuid, ${`u_${user.id.slice(0, 8)}`}, ${user.id}, ${user.name},
                ${user.handicapIndex}, ${user.colorIndex}, ${count[0].n}, ${user.avatarUrl})
      `
    }
  }

  await sql`
    UPDATE round_invites SET status = 'accepted'
    WHERE round_id = ${id}::uuid AND lower(email) = ${email}
  `

  json(res, 200, { round: await loadRound(id) })
})
