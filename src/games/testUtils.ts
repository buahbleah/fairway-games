import { defaultCourse } from '../core/course'
import type { GameContext, GolfGame, HoleEntry, Player, PlayerId } from '../core/types'

export function makePlayers(names: string[], handicaps: (number | null)[] = []): Player[] {
  return names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    handicapIndex: handicaps[i] ?? null,
    colorIndex: i,
  }))
}

export function makeCtx(
  game: GolfGame,
  players: Player[],
  settings: Record<string, any> = {},
  gameState: Record<string, any> = {},
): GameContext {
  const course = defaultCourse()
  const base = game.defaultSettings()
  const merged = { ...base, ...settings }
  const state = { ...game.createRoundState({ players, course, settings: merged }), ...gameState }
  return { players, course, settings: merged, gameState: state }
}

/** Builds a completed hole entry from an array of gross scores in player order. */
export function entry(
  hole: number,
  players: Player[],
  scores: (number | null)[],
  game?: Record<string, any>,
): HoleEntry {
  const map: Record<PlayerId, number | null> = {}
  players.forEach((p, i) => {
    map[p.id] = scores[i] ?? null
  })
  return { hole, scores: map, game, complete: true }
}

export function totals(standings: { playerId: PlayerId; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of standings) out[s.playerId] = s.value
  return out
}
