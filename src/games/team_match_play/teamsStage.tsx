import type { GameContext, Round } from '../../core/types'
import { namesOf } from '../../core/scoring'
import { teamsForHole } from './index'

/**
 * Shown only when the pairing actually changes — the first hole of each block
 * in a rotating-partners round. Fixed teams never see this screen.
 */
export function TeamsStage({
  round,
  ctx,
  onConfirm,
}: {
  round: Round
  ctx: GameContext
  onConfirm: () => void
}) {
  const teams = teamsForHole(ctx, round.currentHole)
  const block = Math.floor((round.currentHole - 1) / 6) + 1

  return (
    <section className="stack stack-4 stage">
      <div>
        <h2 className="stage__prompt">New partners</h2>
        <p className="stage__hint">Holes {(block - 1) * 6 + 1}–{Math.min(block * 6, 18)}</p>
      </div>

      <div className="teamhead">
        <div className="teamside teamside--green">
          <div className="teamside__name">Green</div>
          <div className="teamside__players">{namesOf(round.players, teams[0])}</div>
        </div>
        <div className="matchstate__sub">vs</div>
        <div className="teamside teamside--sand">
          <div className="teamside__name">Sand</div>
          <div className="teamside__players">{namesOf(round.players, teams[1])}</div>
        </div>
      </div>

      <button className="btn btn--primary btn--block btn--xl" onClick={onConfirm}>
        Play
      </button>
    </section>
  )
}
