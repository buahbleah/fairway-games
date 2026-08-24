import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import register from './auth/register.js'
import login from './auth/login.js'
import logout from './auth/logout.js'
import me from './auth/me.js'
import friends from './friends/index.js'
import respondFriend from './friends/respond.js'
import leagues from './leagues/index.js'
import joinLeague from './leagues/join.js'
import roundsIndex from './rounds/index.js'
import roundGet from './rounds/[id]/index.js'
import roundHole from './rounds/[id]/hole.js'
import roundInvite from './rounds/[id]/invite.js'

/**
 * Integration tests against the real database.
 *
 * These only run when DATABASE_URL is set, so `npm test` stays fast and offline
 * for everyone else. They exist mainly to prove the one thing live scoring
 * depends on: two players writing different scores to the same hole must both
 * survive.
 */

const live = !!process.env.DATABASE_URL
const suite = live ? describe : describe.skip

/* ------------------------------------------------------- request plumbing */

interface Captured {
  status: number
  body: any
  cookies: string[]
  headers: Record<string, any>
}

function mockRes(): { res: VercelResponse; captured: Captured } {
  const captured: Captured = { status: 0, body: null, cookies: [], headers: {} }
  const res = {
    status(code: number) {
      captured.status = code
      return this
    },
    setHeader(name: string, value: any) {
      captured.headers[name.toLowerCase()] = value
      if (name.toLowerCase() === 'set-cookie') {
        captured.cookies.push(...(Array.isArray(value) ? value : [value]))
      }
      return this
    },
    send(payload: string) {
      try {
        captured.body = JSON.parse(payload)
      } catch {
        captured.body = payload
      }
      return this
    },
    end() {
      return this
    },
  } as unknown as VercelResponse
  return { res, captured }
}

function mockReq(init: {
  method: string
  body?: any
  query?: Record<string, string>
  cookie?: string
  headers?: Record<string, string>
}): VercelRequest {
  return {
    method: init.method,
    body: init.body,
    query: init.query ?? {},
    headers: {
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.headers ?? {}),
    },
  } as unknown as VercelRequest
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

async function call(
  fn: Handler,
  init: {
    method: string
    body?: any
    query?: Record<string, string>
    session?: string
    bearer?: string
    headers?: Record<string, string>
  },
): Promise<Captured> {
  const { res, captured } = mockRes()
  await fn(
    mockReq({
      ...init,
      cookie: init.session ? `fairway_session=${init.session}` : undefined,
      headers: {
        ...(init.bearer ? { authorization: `Bearer ${init.bearer}` } : {}),
        ...(init.headers ?? {}),
      },
    }),
    res,
  )
  return captured
}

function sessionFrom(captured: Captured): string {
  const cookie = captured.cookies.find((c) => c.startsWith('fairway_session='))
  return cookie ? cookie.split(';')[0].split('=')[1] : ''
}

/* --------------------------------------------------------------- fixtures */

const stamp = Date.now().toString(36)
const marcEmail = `test-marc-${stamp}@fairway.test`
const philEmail = `test-phil-${stamp}@fairway.test`

let marc = ''
let phil = ''
let marcId = ''

suite('The API', () => {
  beforeAll(async () => {
    const a = await call(register, {
      method: 'POST',
      body: { email: marcEmail, name: 'Marc', password: 'longenough1', handicapIndex: 11.4 },
    })
    expect(a.status).toBe(201)
    marc = sessionFrom(a)
    marcId = a.body.user.id

    const b = await call(register, {
      method: 'POST',
      body: { email: philEmail, name: 'Phil', password: 'longenough1', handicapIndex: 18.2 },
    })
    phil = sessionFrom(b)
  })

  afterAll(async () => {
    if (!live) return
    await sql`DELETE FROM users WHERE lower(email) IN (${marcEmail}, ${philEmail})`
  })

  /* ------------------------------------------------------------- accounts */

  it('registers and returns a session', async () => {
    expect(marc).toBeTruthy()
    const who = await call(me, { method: 'GET', session: marc })
    expect(who.body.user.name).toBe('Marc')
    expect(who.body.user.handicapIndex).toBe(11.4)
  })

  it('refuses a duplicate email', async () => {
    const dup = await call(register, {
      method: 'POST',
      body: { email: marcEmail, name: 'Impostor', password: 'longenough1' },
    })
    expect(dup.status).toBe(409)
  })

  it('refuses a short password', async () => {
    const weak = await call(register, {
      method: 'POST',
      body: { email: `x-${stamp}@fairway.test`, name: 'X', password: 'short' },
    })
    expect(weak.status).toBe(400)
  })

  it('signs in with the right password and not the wrong one', async () => {
    const ok = await call(login, { method: 'POST', body: { email: marcEmail, password: 'longenough1' } })
    expect(ok.status).toBe(200)
    const bad = await call(login, { method: 'POST', body: { email: marcEmail, password: 'wrongpassword' } })
    expect(bad.status).toBe(401)
    // Same message for an unknown address, so accounts cannot be enumerated.
    const missing = await call(login, {
      method: 'POST',
      body: { email: `nobody-${stamp}@fairway.test`, password: 'longenough1' },
    })
    expect(missing.status).toBe(401)
    expect(missing.body.error).toBe(bad.body.error)
  })

  it('reports nobody when signed out, without erroring', async () => {
    const who = await call(me, { method: 'GET' })
    expect(who.status).toBe(200)
    expect(who.body.user).toBeNull()
  })

  it('lets a player change their own handicap', async () => {
    const updated = await call(me, { method: 'PATCH', body: { handicapIndex: 9.6 }, session: marc })
    expect(updated.body.user.handicapIndex).toBe(9.6)
    await call(me, { method: 'PATCH', body: { handicapIndex: 11.4 }, session: marc })
  })

  it('rejects a nonsense handicap', async () => {
    const bad = await call(me, { method: 'PATCH', body: { handicapIndex: 99 }, session: marc })
    expect(bad.status).toBe(400)
  })

  /* -------------------------------------------------------------- friends */

  it('sends and accepts a friend request', async () => {
    const sent = await call(friends, { method: 'POST', body: { email: philEmail }, session: marc })
    expect(sent.status).toBe(201)

    const philsView = await call(friends, { method: 'GET', session: phil })
    expect(philsView.body.incoming).toHaveLength(1)
    const requestId = philsView.body.incoming[0].id

    const accepted = await call(respondFriend, {
      method: 'POST',
      body: { id: requestId, action: 'accept' },
      session: phil,
    })
    expect(accepted.body.status).toBe('accepted')

    const marcsView = await call(friends, { method: 'GET', session: marc })
    expect(marcsView.body.friends.map((f: any) => f.name)).toContain('Phil')
  })

  it('keeps a request for an address with no account yet', async () => {
    const sent = await call(friends, {
      method: 'POST',
      body: { email: `future-${stamp}@fairway.test` },
      session: marc,
    })
    expect(sent.status).toBe(201)
    expect(sent.body.hasAccount).toBe(false)
  })

  it('needs a session', async () => {
    const anon = await call(friends, { method: 'GET' })
    expect(anon.status).toBe(401)
  })

  /* -------------------------------------------------------------- leagues */

  it('creates a league and lets someone join with the code', async () => {
    const created = await call(leagues, {
      method: 'POST',
      body: { name: `Test League ${stamp}` },
      session: marc,
    })
    expect(created.status).toBe(201)
    const code = created.body.league.joinCode
    expect(code).toMatch(/^[A-Z0-9]{6}$/)

    // Lower case and spaced out, the way somebody would actually type it.
    const joined = await call(joinLeague, {
      method: 'POST',
      body: { code: ` ${code.toLowerCase()} ` },
      session: phil,
    })
    expect(joined.status).toBe(200)

    const philsLeagues = await call(leagues, { method: 'GET', session: phil })
    expect(philsLeagues.body.leagues.some((l: any) => l.joinCode === code)).toBe(true)
  })

  it('refuses a bad join code', async () => {
    const bad = await call(joinLeague, { method: 'POST', body: { code: 'ZZZZZZ' }, session: marc })
    expect(bad.status).toBe(404)
  })

  /* --------------------------------------------------------------- rounds */

  it('plays a shared round, merging scores from two phones', async () => {
    const created = await call(roundsIndex, {
      method: 'POST',
      session: marc,
      body: {
        gameId: 'skins',
        players: [
          { id: 'a', userId: marcId, name: 'Marc', handicapIndex: 11.4, colorIndex: 0 },
          { id: 'b', userId: null, name: 'Phil', handicapIndex: 18.2, colorIndex: 1 },
        ],
        settings: { skinValue: 1, carryRule: 'carry' },
        course: { id: 'c', name: 'Test', holes: [{ number: 1, par: 4, strokeIndex: 1 }] },
        gameState: {},
        currentHole: 1,
      },
    })
    expect(created.status).toBe(201)
    const roundId = created.body.round.id

    // Phil is invited by email and takes the open seat.
    const invited = await call(roundInvite, {
      method: 'POST',
      query: { id: roundId },
      body: { email: philEmail },
      session: marc,
    })
    expect(invited.body.status).toBe('seated')

    // Marc writes his own score; Phil writes his, from a different session.
    await call(roundHole, {
      method: 'PUT',
      query: { id: roundId },
      body: { hole: 1, scores: { a: 4 } },
      session: marc,
    })
    const afterPhil = await call(roundHole, {
      method: 'PUT',
      query: { id: roundId },
      body: { hole: 1, scores: { b: 5 } },
      session: phil,
    })

    // The whole point: neither write clobbered the other.
    const entry = afterPhil.body.round.entries.find((e: any) => e.hole === 1)
    expect(entry.scores).toEqual({ a: 4, b: 5 })
  })

  it('answers a poll cheaply when nothing has changed', async () => {
    const created = await call(roundsIndex, {
      method: 'POST',
      session: marc,
      body: {
        gameId: 'wolf',
        players: [
          { id: 'a', userId: marcId, name: 'Marc', colorIndex: 0 },
          { id: 'b', name: 'Phil', colorIndex: 1 },
          { id: 'c', name: 'Mike', colorIndex: 2 },
        ],
        settings: {},
        course: {},
        gameState: {},
        currentHole: 1,
      },
    })
    const roundId = created.body.round.id
    const version = created.body.round.version

    const unchanged = await call(roundGet, {
      method: 'GET',
      query: { id: roundId, version: String(version) },
      session: marc,
    })
    expect(unchanged.body.changed).toBe(false)
    expect(unchanged.body.round).toBeUndefined()

    await call(roundHole, {
      method: 'PUT',
      query: { id: roundId },
      body: { hole: 1, scores: { a: 4 } },
      session: marc,
    })

    const changed = await call(roundGet, {
      method: 'GET',
      query: { id: roundId, version: String(version) },
      session: marc,
    })
    expect(changed.body.changed).toBe(true)
    expect(changed.body.round.version).toBeGreaterThan(version)
  })

  it('keeps strangers out of a round', async () => {
    const created = await call(roundsIndex, {
      method: 'POST',
      session: phil,
      body: {
        gameId: 'skins',
        players: [
          { id: 'a', name: 'Phil', colorIndex: 0 },
          { id: 'b', name: 'Guest', colorIndex: 1 },
        ],
        settings: {},
        course: {},
        gameState: {},
        currentHole: 1,
      },
    })
    const roundId = created.body.round.id

    const outsider = await call(register, {
      method: 'POST',
      body: { email: `stranger-${stamp}@fairway.test`, name: 'Stranger', password: 'longenough1' },
    })
    const strangerSession = sessionFrom(outsider)

    const denied = await call(roundGet, { method: 'GET', query: { id: roundId }, session: strangerSession })
    expect(denied.status).toBe(403)

    await sql`DELETE FROM users WHERE lower(email) = ${`stranger-${stamp}@fairway.test`}`
  })

  it('rejects an impossible hole number', async () => {
    const created = await call(roundsIndex, {
      method: 'POST',
      session: marc,
      body: {
        gameId: 'skins',
        players: [
          { id: 'a', userId: marcId, name: 'Marc', colorIndex: 0 },
          { id: 'b', name: 'Guest', colorIndex: 1 },
        ],
        settings: {},
        course: {},
        gameState: {},
        currentHole: 1,
      },
    })
    const bad = await call(roundHole, {
      method: 'PUT',
      query: { id: created.body.round.id },
      body: { hole: 42, scores: { a: 4 } },
      session: marc,
    })
    expect(bad.status).toBe(400)
  })

  it('refuses the wrong HTTP method', async () => {
    const wrong = await call(login, { method: 'GET' })
    expect(wrong.status).toBe(405)
  })

  /* ------------------------------------------- the packaged app's auth path */

  it('hands a token to the packaged app but not to a browser', async () => {
    const native = await call(login, {
      method: 'POST',
      body: { email: marcEmail, password: 'longenough1' },
      headers: { 'x-fairway-client': 'native' },
    })
    expect(typeof native.body.token).toBe('string')
    expect(native.body.token.length).toBeGreaterThan(20)

    const browser = await call(login, {
      method: 'POST',
      body: { email: marcEmail, password: 'longenough1' },
    })
    // A browser gets the httpOnly cookie and nothing script can read.
    expect(browser.body.token).toBeUndefined()
    expect(browser.cookies.some((c) => c.startsWith('fairway_session='))).toBe(true)
  })

  it('accepts that token as a bearer header, with no cookie at all', async () => {
    const native = await call(login, {
      method: 'POST',
      body: { email: marcEmail, password: 'longenough1' },
      headers: { 'x-fairway-client': 'native' },
    })
    const who = await call(me, { method: 'GET', bearer: native.body.token })
    expect(who.status).toBe(200)
    expect(who.body.user?.name).toBe('Marc')
  })

  it('rejects a made-up bearer token', async () => {
    const who = await call(me, { method: 'GET', bearer: 'not-a-real-token' })
    expect(who.body.user).toBeNull()
    const denied = await call(friends, { method: 'GET', bearer: 'not-a-real-token' })
    expect(denied.status).toBe(401)
  })

  it('signing out kills the bearer token too', async () => {
    const native = await call(login, {
      method: 'POST',
      body: { email: marcEmail, password: 'longenough1' },
      headers: { 'x-fairway-client': 'native' },
    })
    await call(logout, { method: 'POST', bearer: native.body.token })
    const after = await call(me, { method: 'GET', bearer: native.body.token })
    expect(after.body.user).toBeNull()
  })

  /* ----------------------------------------------------------------- CORS */

  it('allows the packaged app origin with credentials', async () => {
    const pre = await call(me, { method: 'OPTIONS', headers: { origin: 'https://localhost' } })
    expect(pre.status).toBe(204)
    expect(pre.headers['access-control-allow-origin']).toBe('https://localhost')
    expect(pre.headers['access-control-allow-credentials']).toBe('true')
  })

  it('does not hand credentials to an arbitrary website', async () => {
    const pre = await call(me, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
    expect(pre.headers['access-control-allow-origin']).toBeUndefined()
    expect(pre.headers['access-control-allow-credentials']).toBeUndefined()
  })
})
