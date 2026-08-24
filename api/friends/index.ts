import { sql } from '../_lib/db.js'
import { body, handler, HttpError, json, normaliseEmail } from '../_lib/http.js'
import { requireUser } from '../_lib/auth.js'

/**
 * GET  — your friends, plus requests you have sent and received.
 * POST — ask someone to be a friend, by email address.
 *
 * A request to an address that has no account yet is kept anyway; it attaches
 * itself the moment that person registers. No email is ever sent — the request
 * is simply waiting for them when they sign in.
 */
export default handler(['GET', 'POST'], async (req, res) => {
  const user = await requireUser(req)

  if (req.method === 'GET') {
    const accepted = (await sql`
      SELECT f.id, f.status,
             CASE WHEN f.requester_id = ${user.id} THEN f.addressee_id ELSE f.requester_id END AS other_id
      FROM friendships f
      WHERE f.status = 'accepted'
        AND (f.requester_id = ${user.id} OR f.addressee_id = ${user.id})
    `) as any[]

    const ids = accepted.map((r) => r.other_id).filter(Boolean)
    const friends = ids.length
      ? ((await sql`
          SELECT id, email, name, handicap_index, color_index
          FROM users WHERE id = ANY(${ids}::uuid[])
          ORDER BY name
        `) as any[])
      : []

    const incoming = (await sql`
      SELECT f.id, f.created_at, u.id AS from_id, u.name AS from_name, u.email AS from_email,
             u.handicap_index, u.color_index
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.status = 'pending' AND f.addressee_id = ${user.id}
      ORDER BY f.created_at DESC
    `) as any[]

    const outgoing = (await sql`
      SELECT id, addressee_email, created_at, addressee_id IS NOT NULL AS has_account
      FROM friendships
      WHERE status = 'pending' AND requester_id = ${user.id}
      ORDER BY created_at DESC
    `) as any[]

    json(res, 200, {
      friends: friends.map((f) => ({
        id: f.id,
        email: f.email,
        name: f.name,
        handicapIndex: f.handicap_index === null ? null : Number(f.handicap_index),
        colorIndex: f.color_index,
      })),
      incoming: incoming.map((r) => ({
        id: r.id,
        from: {
          id: r.from_id,
          name: r.from_name,
          email: r.from_email,
          handicapIndex: r.handicap_index === null ? null : Number(r.handicap_index),
          colorIndex: r.color_index,
        },
        createdAt: r.created_at,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        email: r.addressee_email,
        hasAccount: r.has_account,
        createdAt: r.created_at,
      })),
    })
    return
  }

  const email = normaliseEmail(body(req).email)
  if (email === user.email.toLowerCase()) {
    throw new HttpError(400, 'You are already friends with yourself.')
  }

  const targetRows = (await sql`SELECT id FROM users WHERE lower(email) = ${email}`) as any[]
  const targetId: string | null = targetRows[0]?.id ?? null

  if (targetId) {
    // If they already asked you, accept rather than creating a mirrored request.
    const reverse = (await sql`
      SELECT id, status FROM friendships
      WHERE requester_id = ${targetId} AND addressee_id = ${user.id}
    `) as any[]
    if (reverse[0]) {
      if (reverse[0].status !== 'accepted') {
        await sql`UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = ${reverse[0].id}`
      }
      json(res, 200, { status: 'accepted' })
      return
    }
  }

  const rows = (await sql`
    INSERT INTO friendships (requester_id, addressee_email, addressee_id)
    VALUES (${user.id}, ${email}, ${targetId})
    ON CONFLICT (requester_id, lower(addressee_email)) DO UPDATE
      SET status = CASE WHEN friendships.status = 'declined' THEN 'pending' ELSE friendships.status END,
          addressee_id = COALESCE(friendships.addressee_id, EXCLUDED.addressee_id)
    RETURNING id, status
  `) as any[]

  json(res, 201, { id: rows[0].id, status: rows[0].status, hasAccount: !!targetId })
})
