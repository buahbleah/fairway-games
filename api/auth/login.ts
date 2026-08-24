import { sql } from '../_lib/db'
import { body, handler, HttpError, json, normaliseEmail, requireString } from '../_lib/http'
import { createSession, sweepSessions, verifyPassword } from '../_lib/auth'

export default handler(['POST'], async (req, res) => {
  const input = body(req)
  const email = normaliseEmail(input.email)
  const password = requireString(input.password, 'Password', 200)

  const rows = (await sql`
    SELECT id, email, name, password_hash, handicap_index, color_index
    FROM users WHERE lower(email) = ${email}
  `) as any[]
  const row = rows[0]

  // Same message and roughly the same work either way, so this endpoint cannot
  // be used to discover which addresses have accounts.
  const ok = row ? await verifyPassword(password, row.password_hash) : false
  if (!row || !ok) throw new HttpError(401, 'Email or password is incorrect.')

  await createSession(res, row.id)
  void sweepSessions()

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
