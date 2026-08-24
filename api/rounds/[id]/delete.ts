import { sql } from '../../_lib/db.js'
import { handler, HttpError, json, param } from '../../_lib/http.js'
import { requireUser } from '../../_lib/auth.js'

/**
 * Throw a round away. Only the person who started it may do this, because
 * everybody else's scores are in it — leaving a round you did not start should
 * never take it away from the rest of the group.
 */
export default handler(['POST'], async (req, res) => {
  const user = await requireUser(req)
  const id = param(req, 'id')

  const rows = (await sql`SELECT host_id FROM rounds WHERE id = ${id}::uuid`) as any[]
  if (!rows.length) {
    // Already gone is the outcome the caller wanted.
    json(res, 200, { deleted: true })
    return
  }
  if (rows[0].host_id !== user.id) {
    throw new HttpError(403, 'Only whoever started the round can delete it.')
  }

  await sql`DELETE FROM rounds WHERE id = ${id}::uuid`
  json(res, 200, { deleted: true })
})
