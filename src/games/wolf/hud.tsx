import type { HudProps } from '../hudRegistry'
import { namesOf } from '../../core/scoring'
import { MarkWolf } from '../../ui/icons'
import { wolfForHole, type WolfHolePayload } from './index'

export function WolfHud({ round, computed }: HudProps) {
  const entry = round.entries.find((e) => e.hole === round.currentHole)
  const payload = (entry?.game ?? {}) as WolfHolePayload
  const rotation: string[] = computed.extra?.rotation ?? round.players.map((p) => p.id)
  const holeIndex = round.course.holes.findIndex((h) => h.number === round.currentHole)
  const wolfId =
    payload.wolfId ||
    wolfForHole(rotation, holeIndex < 0 ? 0 : holeIndex, round.settings, computed.standings.map((s) => ({ playerId: s.playerId, value: s.value })))

  const wolfName = round.players.find((p) => p.id === wolfId)?.name ?? '—'
  const lone = payload.mode === 'lone' || payload.mode === 'blind'
  const team = lone ? [wolfId] : [wolfId, payload.partnerId].filter(Boolean) as string[]
  const hunters = round.players.map((p) => p.id).filter((id) => !team.includes(id))

  return (
    <div className="card card--tight" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
      <span
        className="resume__mark"
        style={{ width: 38, height: 38, minWidth: 38, background: 'var(--game-wolf-soft)', color: 'var(--game-wolf)' }}
      >
        <MarkWolf size={20} />
      </span>
      <div className="grow">
        <div className="label">Wolf on this hole</div>
        <div style={{ fontWeight: 700 }}>
          {wolfName}
          {payload.mode === 'blind' && ' · Blind'}
          {payload.mode === 'lone' && ' · Alone'}
        </div>
        {payload.mode && (
          <div className="t-sm muted">
            {lone
              ? `${wolfName} v ${namesOf(round.players, hunters)}`
              : `${namesOf(round.players, team)} v ${namesOf(round.players, hunters)}`}
          </div>
        )}
      </div>
    </div>
  )
}
