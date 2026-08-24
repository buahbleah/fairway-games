import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

/**
 * Postgres over HTTP, which is what makes it viable from a short-lived
 * serverless function without connection pooling.
 *
 * The client is created on first use rather than at import time: the test suite
 * and CI import these modules without a DATABASE_URL, and importing a file
 * should never be the thing that fails.
 */

let client: NeonQueryFunction<false, false> | null = null

function connection(): NeonQueryFunction<false, false> {
  if (client) return client
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set on this deployment.')
  client = neon(url)
  return client
}

export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  (connection() as any)(strings, ...values)) as unknown as NeonQueryFunction<false, false>

export type Row = Record<string, any>
