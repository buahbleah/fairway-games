import type { Round } from '../core/types'
import type { Route } from './router'

/**
 * Where "up" goes from each screen.
 *
 * The Back button used to rely purely on browser history, which broke in two
 * ways: history is empty after a reload (and Android reloads the packaged app
 * whenever it reclaims memory), and the round screen is reached with a history
 * *replace*, so there was no entry to go back to at all. Both landed the golfer
 * on the home screen instead of where they came from.
 *
 * These are the fallbacks used when there is genuinely nothing to go back to.
 */
export function parentPath(route: Route): string {
  const { path, params } = route

  if (path.startsWith('/league/')) return '/leagues'
  if (path === '/leagues' || path === '/friends' || path === '/settings' || path === '/history') return '/'
  // A round started from a league belongs to that league, all the way through.
  if (path === '/games') return params.league ? `/league/${params.league}` : '/'
  if (path.startsWith('/game/')) return '/games'
  if (path === '/setup') return params.league ? `/league/${params.league}` : '/games'
  if (path === '/account') return '/settings'
  return '/'
}

/**
 * Where Back goes from a round or its result. A round played in a league
 * returns to that league rather than to the home screen — that is the screen
 * the golfer was on when they started it.
 */
export function upFromRound(round: Pick<Round, 'leagueId'> | null | undefined): string {
  return round?.leagueId ? `/league/${round.leagueId}` : '/'
}
