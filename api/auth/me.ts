import { sql } from '../_lib/db.js'
import { body, handler, HttpError, json, requireString } from '../_lib/http.js'
import { currentUser, destroySession, requireUser } from '../_lib/auth.js'

/**
 * GET    — who am I (null when signed out, not a 401: the app works logged out).
 * PATCH  — update your own name, handicap, avatar or colour. Every player
 *          maintains their own handicap; nobody edits anyone else's.
 * DELETE — remove the account and everything attached to it. Required by both
 *          app stores, and the right thing to offer regardless.
 */

/** Roughly 400 KB of base64, which is far more than a 256px avatar needs. */
const MAX_AVATAR_CHARS = 400_000

function readAvatar(value: unknown): string | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new HttpError(400, 'That image could not be read.')
  if (!value.startsWith('data:image/')) throw new HttpError(400, 'That is not an image.')
  if (value.length > MAX_AVATAR_CHARS) {
    throw new HttpError(400, 'That image is too large. Try a smaller one.')
  }
  return value
}

export default handler(['GET', 'PATCH', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') {
    const user = await currentUser(req)
    json(res, 200, { user })
    return
  }

  const user = await requireUser(req)

  if (req.method === 'DELETE') {
    // Everything else cascades from the user row: sessions, friendships,
    // league memberships, hosted rounds and their holes.
    await sql`DELETE FROM users WHERE id = ${user.id}`
    await destroySession(req, res)
    json(res, 200, { deleted: true })
    return
  }

  const input = body(req)
  const name = input.name === undefined ? user.name : requireString(input.name, 'Name', 60)

  let handicap = user.handicapIndex
  if (input.handicapIndex !== undefined) {
    if (input.handicapIndex === null || input.handicapIndex === '') {
      handicap = null
    } else {
      const value = Number(input.handicapIndex)
      if (Number.isNaN(value) || value < -10 || value > 54) {
        throw new HttpError(400, 'Handicap index must be between -10 and 54.')
      }
      handicap = Math.round(value * 10) / 10
    }
  }

  const colorIndex =
    input.colorIndex === undefined ? user.colorIndex : Math.max(0, Math.min(5, Number(input.colorIndex) || 0))

  const avatarUrl = input.avatarUrl === undefined ? user.avatarUrl : readAvatar(input.avatarUrl)

  const rows = (await sql`
    UPDATE users
    SET name = ${name}, handicap_index = ${handicap}, color_index = ${colorIndex},
        avatar_url = ${avatarUrl}, updated_at = now()
    WHERE id = ${user.id}
    RETURNING id, email, name, handicap_index, color_index, avatar_url
  `) as any[]
  const row = rows[0]

  // Keep the picture and handicap in step wherever this player is already
  // seated, so a round in progress shows the change straight away.
  await sql`
    UPDATE round_players
    SET name = ${row.name}, avatar_url = ${row.avatar_url}, color_index = ${row.color_index},
        handicap_index = ${row.handicap_index}
    WHERE user_id = ${user.id}
  `

  json(res, 200, {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      handicapIndex: row.handicap_index === null ? null : Number(row.handicap_index),
      colorIndex: row.color_index,
      avatarUrl: row.avatar_url,
    },
  })
})
