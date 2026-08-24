import { sql } from '../_lib/db.js'
import { body, handler, HttpError, json, requireString } from '../_lib/http.js'
import { currentUser, requireUser } from '../_lib/auth.js'

/**
 * GET   — who am I (null when signed out, not a 401: the app works logged out).
 * PATCH — update your own name, handicap index or avatar colour. Every player
 *         maintains their own handicap; nobody edits anyone else's.
 */
export default handler(['GET', 'PATCH'], async (req, res) => {
  if (req.method === 'GET') {
    const user = await currentUser(req)
    json(res, 200, { user })
    return
  }

  const user = await requireUser(req)
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

  const rows = (await sql`
    UPDATE users
    SET name = ${name}, handicap_index = ${handicap}, color_index = ${colorIndex}, updated_at = now()
    WHERE id = ${user.id}
    RETURNING id, email, name, handicap_index, color_index
  `) as any[]
  const row = rows[0]

  json(res, 200, {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      handicapIndex: row.handicap_index === null ? null : Number(row.handicap_index),
      colorIndex: row.color_index,
    },
  })
})
