import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './db'
import { HttpError } from './http'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const COOKIE = 'fairway_session'
const SESSION_DAYS = 60
const KEYLEN = 64

/* ------------------------------------------------------------------ passwords */

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.')
  if (password.length > 200) throw new HttpError(400, 'That password is too long.')
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), KEYLEN)
  const expected = Buffer.from(hashHex, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

/* ------------------------------------------------------------------- sessions */

export interface SessionUser {
  id: string
  email: string
  name: string
  handicapIndex: number | null
  colorIndex: number
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

export async function createSession(res: VercelResponse, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expires.toISOString()})`
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  )
  return token
}

export async function destroySession(req: VercelRequest, res: VercelResponse) {
  const token = parseCookies(req.headers.cookie)[COOKIE]
  if (token) await sql`DELETE FROM sessions WHERE token = ${token}`
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`)
}

/** Returns the signed-in user, or null. Never throws for anonymous callers. */
export async function currentUser(req: VercelRequest): Promise<SessionUser | null> {
  const token = parseCookies(req.headers.cookie)[COOKIE]
  if (!token) return null
  const rows = (await sql`
    SELECT u.id, u.email, u.name, u.handicap_index, u.color_index
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
  `) as any[]
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    handicapIndex: row.handicap_index === null ? null : Number(row.handicap_index),
    colorIndex: row.color_index,
  }
}

export async function requireUser(req: VercelRequest): Promise<SessionUser> {
  const user = await currentUser(req)
  if (!user) throw new HttpError(401, 'Sign in to do that.')
  return user
}

/** Purges expired sessions occasionally so the table does not grow forever. */
export async function sweepSessions() {
  if (Math.random() > 0.02) return
  try {
    await sql`DELETE FROM sessions WHERE expires_at < now()`
  } catch {
    /* housekeeping only */
  }
}
