import type { ComputedRound, Round } from '../../core/types'
import { Avatar } from '../../ui/components'
import { MarkWolf } from '../../ui/icons'
import { wolfForHole, type WolfHolePayload } from './index'

/**
 * The choice in words — "Phil as partner", "the lone run". Used both on the
 * keep-what-I-had button here and on the summary bar over the scorecard.
 */
export function describeWolfPick(round: Round, pick?: WolfHolePayload | null): string {
  if (!pick?.mode) return 'no pick yet'
  if (pick.mode === 'lone') return 'the lone run'
  if (pick.mode === 'blind') return 'the blind call'
  const partner = round.players.find((p) => p.id === pick.partnerId)
  return partner ? `${partner.name} as partner` : 'a partner'
}

/**
 * The Wolf's choice. One decision, nothing else on screen competing with it.
 * The order matters: the Wolf sees each player in tee order and takes or passes.
 *
 * It is re-enterable: a mis-tap on the first tee should not sentence anyone to
 * eighteen holes with the wrong partner, so `current` marks what stands and
 * `onCancel` backs out without changing it.
 */
export function WolfPickStage({
  round,
  computed,
  onPick,
  current,
  onCancel,
}: {
  round: Round
  computed: ComputedRound
  onPick: (payload: WolfHolePayload) => void
  /** The choice already on record, when the Wolf is changing their mind. */
  current?: WolfHolePayload | null
  onCancel?: () => void
}) {
  const editing = !!current?.mode
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
            {editing ? `${wolf.name} picks again` : `${wolf.name} picks`}
          </h2>
        </div>
      </div>

      <p className="stage__hint">
        {editing
          ? 'Tap a different choice, or keep the one you have.'
          : 'Take a partner after watching their drive, or take on all of them alone.'}
      </p>

      <div className="stack stack-2">
        {others.map((p, i) => (
          <button
            key={p.id}
            className={`wolfpick${
              current?.mode === 'partner' && current.partnerId === p.id ? ' is-selected' : ''
            }`}
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
        <button
          className={`wolfpick wolfpick--lone${current?.mode === 'lone' ? ' is-selected' : ''}`}
          onClick={() => onPick({ wolfId, mode: 'lone' })}
        >
          <MarkWolf size={22} />
          <span style={{ fontWeight: 700, marginLeft: 8 }}>Lone Wolf — take them all on</span>
        </button>

        {round.settings.blindWolf && (
          <button
            className={`wolfpick wolfpick--blind${current?.mode === 'blind' ? ' is-selected' : ''}`}
            onClick={() => onPick({ wolfId, mode: 'blind' })}
          >
            <span style={{ fontWeight: 700 }}>
              Blind Wolf · {round.settings.blindWolfMultiplier}× points
            </span>
          </button>
        )}
      </div>

      {editing && (
        <button className="btn btn--quiet" onClick={onCancel}>
          Keep {describeWolfPick(round, current)}
        </button>
      )}
    </section>
  )
}
