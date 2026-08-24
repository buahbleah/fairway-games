import type { HudProps } from '../hudRegistry'
import { holeSkinValue } from './index'

export function SkinsHud({ round, computed }: HudProps) {
  const carried = Number(computed.extra?.carried ?? 0)
  const carriedFrom = (computed.extra?.carriedFrom ?? []) as number[]
  const entry = round.entries.find((e) => e.hole === round.currentHole)
  const settled = !!entry?.complete

  // Once the hole is settled the pot on screen belongs to the next one, not to
  // the hole just played — otherwise a carry looks like it applied backwards.
  const hole = settled ? round.currentHole + 1 : round.currentHole
  const pot = holeSkinValue(round.settings, hole) + carried

  return (
    <div className="skinpot">
      <span className="label">{settled ? `Hole ${hole}` : 'On this hole'}</span>
      <span className="skinpot__value num">{pot}</span>
      <span className="t-sm muted">
        {pot === 1 ? 'skin' : 'skins'}
        {carried > 0 && carriedFrom.length > 0
          ? ` · carried from hole${carriedFrom.length > 1 ? 's' : ''} ${carriedFrom.join(', ')}`
          : ''}
      </span>
    </div>
  )
}
