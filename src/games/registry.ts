import type { GameId, GolfGame } from '../core/types'
import { wolfGame } from './wolf'
import { skinsGame } from './skins'
import { nassauGame } from './nassau'
import { vegasGame } from './vegas'
import { dotsGame } from './dots'
import { teamMatchGame } from './team_match_play'

/**
 * The one place that knows about all six games. Screens ask the registry for a
 * module and then talk to the GolfGame interface — never to a specific game.
 * Adding game #7 means adding a folder and one line here.
 */
export const GAMES: GolfGame[] = [wolfGame, skinsGame, nassauGame, vegasGame, dotsGame, teamMatchGame]

export function getGame(id: GameId): GolfGame {
  const game = GAMES.find((g) => g.meta.id === id)
  if (!game) throw new Error(`Unknown game: ${id}`)
  return game
}

export function gameExists(id: string): id is GameId {
  return GAMES.some((g) => g.meta.id === id)
}
