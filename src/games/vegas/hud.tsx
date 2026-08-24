import type { HudProps } from '../hudRegistry'
import { namesOf } from '../../core/scoring'
import { calcHole, teamsForHole } from './index'

/**
 * The Vegas number, built in front of the golfer: two scores, then the number
 * they make together, then the difference. This is the whole game in one look.
 */
export function VegasHud({ round, ctx, computed, stage }: HudProps) {
  const entry = round.entries.find((e) => e.hole === round.currentHole)
  const teams = teamsForHole(ctx, round.currentHole)
  const calc = entry ? calcHole(ctx, entry) : null
  const teamViews = computed.teams ?? []

  if (!calc || stage === 'pick' || stage === 'teams') {
    return (
      <div className="teamhead">
        <TeamCell name={namesOf(round.players, teams[0])} tone="green" />
        <span className="matchstate__sub">vs</span>
        <TeamCell name={namesOf(round.players, teams[1])} tone="sand" />
      </div>
    )
  }

  return (
    <div className="stack stack-2">
      {[0, 1].map((t) => {
        const team = calc.teams[t]
        const scores = team.map((id) => calc.scores[id] ?? 0)
        const low = Math.min(...scores)
        const high = Math.max(...scores)
        const [first, second] = calc.flipped[t] ? [high, low] : [low, high]
        return (
          <div key={t} className={`vegasrow vegasrow--${t === 0 ? 'green' : 'sand'}`}>
            <span className="vegasrow__name">
              {teamViews[t]?.name ?? namesOf(round.players, team)}
              {calc.flipped[t] && <span className="vegasrow__flip">flipped</span>}
            </span>
            <span className="vegasnum__digit num">{first}</span>
            <span className="vegasnum__digit num">{second}</span>
            <span className="vegasnum__arrow" aria-hidden>
              →
            </span>
            <span className="vegasrow__total num">{calc.numbers[t]}</span>
          </div>
        )
      })}

      <div className="vegasdiff">
        <span className="label" style={{ color: 'var(--sand-300)' }}>
          Difference
        </span>
        <span className="vegasdiff__value">{calc.diff}</span>
        <span className="t-sm" style={{ opacity: 0.85 }}>
          {calc.winner === null
            ? 'Tied hole'
            : `${namesOf(round.players, calc.teams[calc.winner])} +${calc.points}`}
        </span>
      </div>
    </div>
  )
}

function TeamCell({ name, tone }: { name: string; tone: 'green' | 'sand' }) {
  return (
    <div className={`teamside teamside--${tone}`}>
      <div className="teamside__name">{tone === 'green' ? 'Team Green' : 'Team Sand'}</div>
      <div className="teamside__players">{name}</div>
    </div>
  )
}
