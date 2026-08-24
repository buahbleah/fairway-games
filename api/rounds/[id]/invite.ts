import { sql } from '../../_lib/db'
import { body, handler, HttpError, json, normaliseEmail, param } from '../../_lib/http'
import { requireUser } from '../../_lib/auth'
import { assertAccess, loadRound } from '../../_lib/rounds'

/**
 * Invite someone to a round by email. If they already have an account and a
 * seat is free, they are seated straight away and can start scoring. If not,
 * the invite waits for them — nothing is emailed.
 */
export default handler(['POST'], async (req, res) => {
  const user = await requireUser(req)
  const id = param(req, 'id')
  await assertAccess(id, user)

  const email = normaliseEmail(body(req).email)

  const userRows = (await sql`
    SELECT id, name, handicap_index, color_index FROM users WHERE lower(email) = ${email}
  `) as any[]
  const invitee = userRows[0]

  await sql`
    INSERT INTO round_invites (round_id, email, invited_by)
    VALUES (${id}::uuid, ${email}, ${user.id})
    ON CONFLICT (round_id, lower(email)) DO UPDATE SET status = 'pending'
  `

  if (!invitee) {
    json(res, 202, { status: 'pending', hasAccount: false })
    return
  }

  const already = (await sql`
    SELECT 1 FROM round_players WHERE round_id = ${id}::uuid AND user_id = ${invitee.id}
  `) as any[]
  if (already.length) {
    json(res, 200, { status: 'already-playing', hasAccount: true })
    return
  }

  // Seat them against a free guest slot if the host left one, otherwise add a
  // new seat — the game module still enforces its own player limits on entry.
  const openSeat = (await sql`
    SELECT player_id FROM round_players
    WHERE round_id = ${id}::uuid AND user_id IS NULL
    ORDER BY seat LIMIT 1
  `) as any[]

  if (openSeat.length) {
    await sql`
      UPDATE round_players
      SET user_id = ${invitee.id}, name = ${invitee.name},
          handicap_index = COALESCE(${invitee.handicap_index}, handicap_index),
          color_index = ${invitee.color_index}
      WHERE round_id = ${id}::uuid AND player_id = ${openSeat[0].player_id}
    `
  } else {
    const count = (await sql`
      SELECT count(*)::int AS n FROM round_players WHERE round_id = ${id}::uuid
    `) as any[]
    if (count[0].n >= 4) throw new HttpError(409, 'That round is already full.')
    await sql`
      INSERT INTO round_players (round_id, player_id, user_id, name, handicap_index, color_index, seat)
      VALUES (${id}::uuid, ${`u_${invitee.id.slice(0, 8)}`}, ${invitee.id}, ${invitee.name},
              ${invitee.handicap_index}, ${invitee.color_index}, ${count[0].n})
    `
  }

  await sql`
    UPDATE round_invites SET status = 'accepted'
    WHERE round_id = ${id}::uuid AND lower(email) = ${email}
  `

  json(res, 200, { status: 'seated', hasAccount: true, round: await loadRound(id) })
})
