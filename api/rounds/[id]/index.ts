import { sql } from '../../_lib/db'
import { body, handler, json, param } from '../../_lib/http'
import { requireUser } from '../../_lib/auth'
import { assertAccess, loadRound, roundVersion } from '../../_lib/rounds'

/**
 * GET   — the whole round. Pass ?version=N and, if nothing has changed since,
 *         you get a tiny {changed:false} back instead of the full document.
 *         That is what makes a 4-second poll cheap enough to leave running.
 * PATCH — round-level fields: current hole, status, settings, game state.
 */
export default handler(['GET', 'PATCH'], async (req, res) => {
  const user = await requireUser(req)
  const id = param(req, 'id')
  await assertAccess(id, user)

  if (req.method === 'GET') {
    const since = Number(req.query.version)
    if (Number.isFinite(since) && since > 0) {
      const current = await roundVersion(id)
      if (current === since) {
        json(res, 200, { changed: false, version: current })
        return
      }
    }
    json(res, 200, { changed: true, round: await loadRound(id) })
    return
  }

  const input = body(req)

  if (input.currentHole !== undefined) {
    await sql`
      UPDATE rounds SET current_hole = ${Number(input.currentHole) || 1}, version = version + 1, updated_at = now()
      WHERE id = ${id}::uuid
    `
  }
  if (input.status === 'active' || input.status === 'finished') {
    await sql`
      UPDATE rounds SET status = ${input.status}, version = version + 1, updated_at = now()
      WHERE id = ${id}::uuid
    `
  }
  if (input.settings !== undefined) {
    await sql`
      UPDATE rounds SET settings = ${JSON.stringify(input.settings)}::jsonb, version = version + 1, updated_at = now()
      WHERE id = ${id}::uuid
    `
  }
  if (input.gameState !== undefined) {
    // Merged rather than replaced, so a press added on one phone is not wiped
    // out by a team rename arriving from another.
    await sql`
      UPDATE rounds SET game_state = game_state || ${JSON.stringify(input.gameState)}::jsonb,
                        version = version + 1, updated_at = now()
      WHERE id = ${id}::uuid
    `
  }

  json(res, 200, { round: await loadRound(id) })
})
