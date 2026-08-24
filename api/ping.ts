import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * A diagnostic endpoint with no imports of our own. If this responds but the
 * real endpoints do not, the problem is in our modules rather than in the
 * function runtime itself. It also reports whether DATABASE_URL reached the
 * deployment, without ever revealing its value.
 */
export default function ping(_req: VercelRequest, res: VercelResponse) {
  res.status(200).setHeader('Content-Type', 'application/json')
  res.send(
    JSON.stringify({
      ok: true,
      node: process.version,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      region: process.env.VERCEL_REGION ?? null,
    }),
  )
}
