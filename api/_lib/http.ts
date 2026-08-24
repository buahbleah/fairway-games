import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Everything the API returns is JSON, including failures. */
export function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

export function fail(res: VercelResponse, status: number, message: string, extra?: Record<string, unknown>) {
  json(res, status, { error: message, ...extra })
}

/** Thrown by handlers to short-circuit with a specific status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

/**
 * Origins allowed to call the API with credentials.
 *
 * The packaged Android and iOS apps serve their own pages from a localhost
 * scheme, so from the API's point of view they are a different origin. They are
 * listed explicitly rather than reflected, because allowing an arbitrary origin
 * together with credentials would let any website act on a signed-in user's
 * behalf.
 */
const ALLOWED_ORIGINS = new Set([
  'https://localhost', // Capacitor Android
  'capacitor://localhost', // Capacitor iOS
  'ionic://localhost',
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // vite preview
])

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin
  if (!origin) return
  // Same-origin requests from the deployed site need nothing; anything else has
  // to be on the list.
  if (!ALLOWED_ORIGINS.has(origin)) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Fairway-Client')
  res.setHeader('Vary', 'Origin')
}

/**
 * Wraps a handler so any thrown error becomes a clean JSON response instead of
 * a stack trace, and so unexpected errors are never leaked to the client.
 */
export function handler(methods: string[], fn: Handler): Handler {
  return async (req, res) => {
    applyCors(req, res)

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '))
      res.setHeader('Access-Control-Max-Age', '86400')
      res.setHeader('Allow', [...methods, 'OPTIONS'].join(', '))
      res.status(204).end()
      return
    }
    if (!methods.includes(req.method ?? '')) {
      res.setHeader('Allow', methods.join(', '))
      fail(res, 405, `Use ${methods.join(' or ')} for this endpoint.`)
      return
    }
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof HttpError) {
        fail(res, err.status, err.message)
        return
      }
      console.error('Unhandled API error:', err)
      fail(res, 500, 'Something went wrong on our side.')
    }
  }
}

/** Vercel parses JSON bodies, but be forgiving about a raw string body. */
export function body<T = Record<string, any>>(req: VercelRequest): T {
  const raw = req.body
  if (!raw) return {} as T
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      throw new HttpError(400, 'Could not read the request body.')
    }
  }
  return raw as T
}

export function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${field} is required.`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) throw new HttpError(400, `${field} is too long.`)
  return trimmed
}

export function normaliseEmail(value: unknown): string {
  const email = requireString(value, 'Email', 200).toLowerCase()
  // Deliberately permissive: the point is to catch typos, not to police RFC 5322.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'That does not look like an email address.')
  }
  return email
}

export function param(req: VercelRequest, name: string): string {
  const value = req.query[name]
  const single = Array.isArray(value) ? value[0] : value
  if (!single) throw new HttpError(400, `Missing ${name}.`)
  return single
}

/**
 * The packaged apps identify themselves so the session token can be returned in
 * the response body. A browser never gets it — it uses the httpOnly cookie,
 * which cannot be read by script at all.
 */
export function isNativeClient(req: VercelRequest): boolean {
  return req.headers['x-fairway-client'] === 'native'
}
