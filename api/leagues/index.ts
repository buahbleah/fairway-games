import { randomBytes } from 'node:crypto'
import { sql } from '../_lib/db'
import { body, handler, json, requireString } from '../_lib/http'
import { requireUser } from '../_lib/auth'

/**
 * GET  — the leagues you belong to, with member counts and round counts.
 * POST — start a new league. It gets a short join code you can pass around.
 */

/** Six characters, no vowels and no look-alikes, so it survives being read aloud. */
function joinCode(): string {
  const alphabet = '23456789BCDFGHJKMNPQRSTVWXYZ'
  const bytes = randomBytes(6)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export default handler(['GET', 'POST'], async (req, res) => {
  const user = await requireUser(req)

  if (req.method === 'GET') {
    const rows = (await sql`
      SELECT l.id, l.name, l.description, l.join_code, l.owner_id, l.created_at,
             lm.role,
             (SELECT count(*) FROM league_members m WHERE m.league_id = l.id) AS member_count,
             (SELECT count(*) FROM rounds r WHERE r.league_id = l.id) AS round_count
      FROM leagues l
      JOIN league_members lm ON lm.league_id = l.id AND lm.user_id = ${user.id}
      ORDER BY l.created_at DESC
    `) as any[]

    json(res, 200, {
      leagues: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        joinCode: r.join_code,
        role: r.role,
        isOwner: r.owner_id === user.id,
        memberCount: Number(r.member_count),
        roundCount: Number(r.round_count),
        createdAt: r.created_at,
      })),
    })
    return
  }

  const input = body(req)
  const name = requireString(input.name, 'League name', 60)
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim().slice(0, 240)
      : null

  const code = joinCode()
  const rows = (await sql`
    INSERT INTO leagues (name, description, owner_id, join_code)
    VALUES (${name}, ${description}, ${user.id}, ${code})
    RETURNING id, name, description, join_code, created_at
  `) as any[]
  const league = rows[0]

  await sql`
    INSERT INTO league_members (league_id, user_id, role)
    VALUES (${league.id}, ${user.id}, 'owner')
  `

  json(res, 201, {
    league: {
      id: league.id,
      name: league.name,
      description: league.description,
      joinCode: league.join_code,
      role: 'owner',
      isOwner: true,
      memberCount: 1,
      roundCount: 0,
      createdAt: league.created_at,
    },
  })
})
