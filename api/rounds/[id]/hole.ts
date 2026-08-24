import { sql } from '../../_lib/db.js'
import { body, handler, HttpError, json, param } from '../../_lib/http.js'
import { requireUser } from '../../_lib/auth.js'
import { assertAccess, loadRound } from '../../_lib/rounds.js'

/**
 * Write one hole.
 *
 * Scores are merged key by key (`scores || excluded.scores`), which is the
 * whole trick behind live scoring: if Marc enters his own 4 on his phone while
 * Phil enters his 5 on his, both survive. Whoever writes last does not clobber
 * the other's number — only their own key is replaced.
 */
export default handler(['PUT'], async (req, res) => {
  const user = await requireUser(req)
  const id = param(req, 'id')
  const round = await assertAccess(id, user)
  if (round.status === 'finished') {
    throw new HttpError(409, 'That round has been finished. Reopen it to keep scoring.')
  }

  const input = body(req)
  const hole = Number(input.hole)
  if (!Number.isInteger(hole) || hole < 1 || hole > 18) {
    throw new HttpError(400, 'Hole must be between 1 and 18.')
  }

  const scores = input.scores && typeof input.scores === 'object' ? input.scores : {}
  const game = input.game && typeof input.game === 'object' ? input.game : {}
  const complete = input.complete === true

  await sql`
    INSERT INTO hole_entries (round_id, hole, scores, game, complete, updated_by)
    VALUES (${id}::uuid, ${hole}, ${JSON.stringify(scores)}::jsonb, ${JSON.stringify(game)}::jsonb, ${complete}, ${user.id})
    ON CONFLICT (round_id, hole) DO UPDATE SET
      scores = hole_entries.scores || EXCLUDED.scores,
      game = hole_entries.game || EXCLUDED.game,
      complete = EXCLUDED.complete,
      updated_at = now(),
      updated_by = ${user.id}
  `

  json(res, 200, { round: await loadRound(id) })
})
