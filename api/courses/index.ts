import { sql } from '../_lib/db.js'
import { handler, HttpError, json } from '../_lib/http.js'

/**
 * Course lookup, proxied to GolfCourseAPI.
 *
 *   GET /api/courses?q=winterthur   search by club or course name
 *   GET /api/courses?id=4711        one course, with every tee and card
 *
 * Two reasons this is not called from the browser directly. The key would be in
 * the bundle, and the free tier allows only a few dozen calls a day — a number
 * four players opening Round Setup on the same tee would spend in a minute.
 *
 * So: every answer is cached in Postgres and served from there, and the number
 * of calls that actually leave for the API is counted and capped. A miss after
 * the cap says so plainly rather than failing at the network.
 */

const API = 'https://api.golfcourseapi.com/v1'

/** Left under the real limit so a bad day never costs the whole allowance. */
const DAILY_BUDGET = Number(process.env.GOLF_COURSE_API_DAILY_BUDGET ?? 40)

/** Names change rarely; a card essentially never. Both are re-checked eventually. */
const SEARCH_TTL_DAYS = 30
const COURSE_TTL_DAYS = 180

function key(kind: 'search' | 'course', value: string): string {
  return `${kind}:${value}`
}

async function cached(k: string, ttlDays: number): Promise<any | null> {
  const rows = (await sql`
    SELECT payload FROM course_cache
    WHERE key = ${k} AND fetched_at > now() - make_interval(days => ${ttlDays})
  `) as any[]
  return rows[0]?.payload ?? null
}

async function store(k: string, payload: unknown) {
  await sql`
    INSERT INTO course_cache (key, payload, fetched_at)
    VALUES (${k}, ${JSON.stringify(payload)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()
  `
}

/**
 * Claims one call against today's budget. The increment and the check happen in
 * the same statement, so two requests arriving together cannot both be told
 * they had the last call.
 */
async function claimCall(): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO course_api_usage (day, calls) VALUES (current_date, 1)
    ON CONFLICT (day) DO UPDATE
      SET calls = course_api_usage.calls + 1
      WHERE course_api_usage.calls < ${DAILY_BUDGET}
    RETURNING calls
  `) as any[]
  return rows.length > 0
}

async function fromApi(path: string): Promise<any> {
  const apiKey = process.env.GOLF_COURSE_API_KEY
  if (!apiKey) {
    throw new HttpError(503, 'Course search is not configured on this deployment yet.')
  }
  if (!(await claimCall())) {
    throw new HttpError(
      429,
      'Course lookups are used up for today. Courses looked up before still work, and you can always set the card by hand.',
    )
  }

  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Key ${apiKey}` },
  })

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'The course database rejected our key.')
  }
  if (response.status === 429) {
    throw new HttpError(429, 'The course database is rate limiting us. Try again tomorrow.')
  }
  if (!response.ok) {
    throw new HttpError(502, 'The course database did not answer properly.')
  }
  return response.json()
}

export default handler(['GET'], async (req, res) => {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  if (id) {
    if (!/^[0-9]+$/.test(id)) throw new HttpError(400, 'That is not a course id.')
    const k = key('course', id)
    const hit = await cached(k, COURSE_TTL_DAYS)
    if (hit) {
      json(res, 200, { course: hit, cached: true })
      return
    }
    const payload = await fromApi(`/courses/${id}`)
    await store(k, payload)
    json(res, 200, { course: payload, cached: false })
    return
  }

  if (q.length < 3) {
    throw new HttpError(400, 'Type at least three letters of the club name.')
  }
  // Normalised so "Winterthur", "winterthur " and "WINTERTHUR" are one entry.
  const normalised = q.toLowerCase().replace(/\s+/g, ' ')
  const k = key('search', normalised)

  const hit = await cached(k, SEARCH_TTL_DAYS)
  if (hit) {
    json(res, 200, { results: hit, cached: true })
    return
  }

  const payload = await fromApi(`/search?search_query=${encodeURIComponent(normalised)}`)
  await store(k, payload)
  json(res, 200, { results: payload, cached: false })
})
