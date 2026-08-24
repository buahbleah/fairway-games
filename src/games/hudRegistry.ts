import type { ComponentType } from 'react'
import type { ComputedRound, GameContext, GameId, HoleEntry, Round } from '../core/types'
import { WolfHud } from './wolf/hud'
import { SkinsHud } from './skins/hud'
import { NassauHud } from './nassau/hud'
import { VegasHud } from './vegas/hud'
import { DotsHud } from './dots/hud'
import { TeamMatchHud } from './team_match_play/hud'

export interface HudProps {
  round: Round
  ctx: GameContext
  computed: ComputedRound
  stage: string
  /** Merge into the current hole's entry — used for concessions. */
  patchEntry: (patch: Partial<HoleEntry>, undoLabel?: string) => void
  /** Merge into round-level game state — used for presses. */
  patchGameState: (patch: Record<string, any>, undoLabel?: string) => void
}

/**
 * Each game owns the strip of information that sits above the hole — the skins
 * pot, the Nassau segments, the Vegas number. The Play screen never knows what
 * any of them mean; it just renders the game's own component.
 */
const HUDS: Record<GameId, ComponentType<HudProps>> = {
  wolf: WolfHud,
  skins: SkinsHud,
  nassau: NassauHud,
  vegas: VegasHud,
  dots: DotsHud,
  team_match_play: TeamMatchHud,
}

export function getHud(id: GameId): ComponentType<HudProps> {
  return HUDS[id]
}
