import type { HudProps } from '../hudRegistry'
import { holeByNumber } from '../../core/course'

export function DotsHud({ round, computed, stage }: HudProps) {
  // The "anything extra?" step needs the whole screen for four players' chips.
  if (stage === 'extras') return null
  const hole = holeByNumber(round.course, round.currentHole)
  const leader = computed.standings[0]
  const leaderName = round.players.find((p) => p.id === leader?.playerId)?.name

  return (
    <div className="statgrid">
      <div className="stat">
        <div className="stat__label">Par</div>
        <div className="stat__value">{hole.par}</div>
      </div>
      <div className="stat">
        <div className="stat__label">Leading</div>
        <div className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
          {leader && leader.value !== 0 ? leaderName : '—'}
        </div>
      </div>
      <div className="stat">
        <div className="stat__label">Dots</div>
        <div className="stat__value">{leader?.display ?? '0'}</div>
      </div>
    </div>
  )
}
