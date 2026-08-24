import { sql } from '../_lib/db.js'
import { body, handler, HttpError, isNativeClient, json, normaliseEmail, requireString } from '../_lib/http.js'
import { createSession, hashPassword } from '../_lib/auth.js'

/**
 * Sign-up with an email address and a password. There is no email verification
 * step because the app sends no email — a friend request simply appears for
 * whoever signs in with that address.
 */
export default handler(['POST'], async (req, res) => {
  const input = body(req)
  const email = normaliseEmail(input.email)
  const name = requireString(input.name, 'Name', 60)
  const password = requireString(input.password, 'Password', 200)

  const existing = (await sql`SELECT id FROM users WHERE lower(email) = ${email}`) as any[]
  if (existing.length) {
    throw new HttpError(409, 'That email already has an account. Try signing in.')
  }

  const passwordHash = await hashPassword(password)
  const handicap =
    input.handicapIndex === null || input.handicapIndex === undefined || input.handicapIndex === ''
      ? null
      : Number(input.handicapIndex)
  if (handicap !== null && (Number.isNaN(handicap) || handicap < -10 || handicap > 54)) {
    throw new HttpError(400, 'Handicap index must be between -10 and 54.')
  }

  const colorIndex = Math.floor(Math.random() * 6)
  const rows = (await sql`
    INSERT INTO users (email, name, password_hash, handicap_index, color_index)
    VALUES (${email}, ${name}, ${passwordHash}, ${handicap}, ${colorIndex})
    RETURNING id, email, name, handicap_index, color_index
  `) as any[]
  const user = rows[0]

  // Any friend requests already waiting on this address now belong to this user.
  await sql`
    UPDATE friendships SET addressee_id = ${user.id}
    WHERE lower(addressee_email) = ${email} AND addressee_id IS NULL
  `

  const token = await createSession(res, user.id)
  json(res, 201, {
    // Browsers use the httpOnly cookie and ignore this; the packaged apps store
    // it and send it back as a bearer header.
    token: isNativeClient(req) ? token : undefined,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      handicapIndex: user.handicap_index === null ? null : Number(user.handicap_index),
      colorIndex: user.color_index,
    },
  })
})
