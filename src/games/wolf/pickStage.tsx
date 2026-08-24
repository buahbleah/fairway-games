import type { ComputedRound, Round } from '../../core/types'
import { Avatar } from '../../ui/components'
import { MarkWolf } from '../../ui/icons'
import { wolfForHole, type WolfHolePayload } from './index'

/**
 * The Wolf's choice. One decision, nothing else on screen competing with it.
 * The order matters: the Wolf sees each player in tee order and takes or passes.
 */
export function WolfPickStage({
  round,
  computed,
  onPick,
}: {
  round: Round
  computed: ComputedRound
  onPick: (payload: WolfHolePayload) => void
}) {
  const rotation: string[] = computed.extra?.rotation ?? round.players.map((p) => p.id)
  const holeIndex = round.course.holes.findIndex((h) => h.number === round.currentHole)
  const wolfId = wolfForHole(
    rotation,
    holeIndex < 0 ? round.currentHole - 1 : holeIndex,
    round.settings,
    computed.standings.map((s) => ({ playerId: s.playerId, value: s.value })),
  )
  const wolf = round.players.find((p) => p.id === wolfId) ?? round.players[0]
  const others = rotation
    .filter((id) => id !== wolfId)
    .map((id) => round.players.find((p) => p.id === id)!)
    .filter(Boolean)

  return (
    <section className="stack stack-4 stage">
      <div className="row" style={{ gap: 'var(--s-3)' }}>
        <Avatar player={wolf} size="lg" />
        <div>
          <span className="wolfbadge">
            <MarkWolf size={13} /> Wolf
          </span>
          <h2 className="stage__prompt" style={{ marginTop: 4 }}>
            {wolf.name} picks
          </h2>
        </div>
      </div>

      <p className="stage__hint">
        Take a partner after watching their drive, or take on all of them alone.
      </p>

      <div className="stack stack-2">
        {others.map((p, i) => (
          <button
            key={p.id}
            className="wolfpick"
            onClick={() => onPick({ wolfId, mode: 'partner', partnerId: p.id })}
          >
            <Avatar player={p} />
            <span className="grow">
              <span style={{ fontWeight: 700, display: 'block' }}>{p.name}</span>
              <span className="t-sm muted">Drives {i === 0 ? 'first' : i === 1 ? 'second' : 'third'}</span>
            </span>
            <span className="chip chip--good">Partner</span>
          </button>
        ))}
      </div>

      <div className="stack stack-2">
        <button className="wolfpick wolfpick--lone" onClick={() => onPick({ wolfId, mode: 'lone' })}>
          <MarkWolf size={22} />
          <span style={{ fontWeight: 700, marginLeft: 8 }}>Lone Wolf — take them all on</span>
        </button>

        {round.settings.blindWolf && (
          <button className="wolfpick wolfpick--blind" onClick={() => onPick({ wolfId, mode: 'blind' })}>
            <span style={{ fontWeight: 700 }}>
              Blind Wolf · {round.settings.blindWolfMultiplier}× points
            </span>
          </button>
        )}
      </div>
    </section>
  )
}
