import { sql } from '../_lib/db'
import { body, handler, HttpError, json, requireString } from '../_lib/http'
import { requireUser } from '../_lib/auth'

/** Accept or decline a friend request that was sent to you. */
export default handler(['POST'], async (req, res) => {
  const user = await requireUser(req)
  const input = body(req)
  const id = requireString(input.id, 'Request id', 64)
  const action = requireString(input.action, 'Action', 16)
  if (action !== 'accept' && action !== 'decline') {
    throw new HttpError(400, 'Action must be accept or decline.')
  }

  const rows = (await sql`
    UPDATE friendships
    SET status = ${action === 'accept' ? 'accepted' : 'declined'}, responded_at = now()
    WHERE id = ${id}::uuid AND addressee_id = ${user.id} AND status = 'pending'
    RETURNING id, status
  `) as any[]

  if (!rows.length) throw new HttpError(404, 'That request is no longer waiting for you.')
  json(res, 200, { id: rows[0].id, status: rows[0].status })
})
