import { sql } from '../_lib/db'
import { body, handler, HttpError, json, requireString } from '../_lib/http'
import { requireUser } from '../_lib/auth'

/** Join a league with its code. Codes are case-insensitive and space-tolerant. */
export default handler(['POST'], async (req, res) => {
  const user = await requireUser(req)
  const raw = requireString(body(req).code, 'Join code', 32)
  const code = raw.replace(/[\s-]/g, '').toUpperCase()

  const rows = (await sql`SELECT id, name FROM leagues WHERE join_code = ${code}`) as any[]
  const league = rows[0]
  if (!league) throw new HttpError(404, 'No league found with that code.')

  await sql`
    INSERT INTO league_members (league_id, user_id, role)
    VALUES (${league.id}, ${user.id}, 'member')
    ON CONFLICT (league_id, user_id) DO NOTHING
  `

  json(res, 200, { id: league.id, name: league.name })
})
