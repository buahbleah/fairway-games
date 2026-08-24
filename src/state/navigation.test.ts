import { describe, expect, it } from 'vitest'
import { parentPath, upFromRound } from './navigation'
import type { Route } from './router'

const route = (path: string, params: Record<string, string> = {}): Route => ({ path, params })

/**
 * Regression tests for a reported bug: Back from a round did not return to the
 * league it was played in — it always went to the home screen.
 */

describe('Back from a round', () => {
  it('returns to the league the round belongs to', () => {
    expect(upFromRound({ leagueId: 'abc-123' })).toBe('/league/abc-123')
  })

  it('goes home for a round with no league', () => {
    expect(upFromRound({ leagueId: null })).toBe('/')
    expect(upFromRound({ leagueId: undefined })).toBe('/')
    expect(upFromRound(null)).toBe('/')
    expect(upFromRound(undefined)).toBe('/')
  })
})

describe('Back through the round-setup flow', () => {
  it('keeps the league all the way down', () => {
    // League → Start a league round → pick a game → setup
    expect(parentPath(route('/games', { league: 'abc' }))).toBe('/league/abc')
    expect(parentPath(route('/setup', { game: 'wolf', league: 'abc' }))).toBe('/league/abc')
  })

  it('falls back sensibly when no league is involved', () => {
    expect(parentPath(route('/games'))).toBe('/')
    expect(parentPath(route('/setup', { game: 'wolf' }))).toBe('/games')
  })
})

describe('Back everywhere else', () => {
  it('steps up one level at a time', () => {
    expect(parentPath(route('/league/xyz'))).toBe('/leagues')
    expect(parentPath(route('/leagues'))).toBe('/')
    expect(parentPath(route('/friends'))).toBe('/')
    expect(parentPath(route('/settings'))).toBe('/')
    expect(parentPath(route('/history'))).toBe('/')
    expect(parentPath(route('/game/vegas'))).toBe('/games')
    expect(parentPath(route('/account'))).toBe('/settings')
  })

  it('never leaves the golfer nowhere', () => {
    for (const path of ['/', '/nonsense', '/play', '/results', '']) {
      expect(parentPath(route(path))).toBe('/')
    }
  })
})
