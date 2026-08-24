import { sql } from './_lib/db'
import { handler, json } from './_lib/http'
import { requireUser } from './_lib/auth'

/**
 * Everything waiting for you: round invitations and friend requests. This is
 * what the home screen badge counts.
 */
export default handler(['GET'], async (req, res) => {
  const user = await requireUser(req)
  const email = user.email.toLowerCase()

  const rounds = (await sql`
    SELECT i.id, i.round_id, i.created_at, r.game_id, r.title, r.status,
           u.name AS invited_by_name, l.name AS league_name
    FROM round_invites i
    JOIN rounds r ON r.id = i.round_id
    JOIN users u ON u.id = i.invited_by
    LEFT JOIN leagues l ON l.id = r.league_id
    WHERE lower(i.email) = ${email}
      AND i.status = 'pending'
      AND r.status = 'active'
    ORDER BY i.created_at DESC
  `) as any[]

  const friends = (await sql`
    SELECT f.id, f.created_at, u.name, u.email
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.status = 'pending' AND f.addressee_id = ${user.id}
    ORDER BY f.created_at DESC
  `) as any[]

  json(res, 200, {
    rounds: rounds.map((r) => ({
      id: r.id,
      roundId: r.round_id,
      gameId: r.game_id,
      title: r.title,
      leagueName: r.league_name,
      invitedBy: r.invited_by_name,
      createdAt: r.created_at,
    })),
    friends: friends.map((f) => ({
      id: f.id,
      name: f.name,
      email: f.email,
      createdAt: f.created_at,
    })),
    total: rounds.length + friends.length,
  })
})
