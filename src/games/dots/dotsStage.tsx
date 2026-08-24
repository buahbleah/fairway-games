import { holeByNumber, scoreName } from '../../core/course'
import type { HoleEntry, PlayerId, Round } from '../../core/types'
import { Avatar } from '../../ui/components'
import { parseDots } from './dotTypes'

/**
 * "Anything extra?" — the whole point is that this takes a few seconds.
 * Automatic dots (birdies, eagles) are shown as already earned; the golfer only
 * taps the things the app cannot know.
 */
export function DotsStage({
  round,
  entry,
  onChange,
}: {
  round: Round
  entry: HoleEntry | undefined
  onChange: (dots: Record<PlayerId, string[]>) => void
}) {
  const dots = parseDots(round.settings.dots as string).filter((d) => d.enabled && !d.auto)
  const hole = holeByNumber(round.course, round.currentHole)
  const tapped = (entry?.game?.dots ?? {}) as Record<PlayerId, string[]>

  const toggle = (playerId: PlayerId, dotId: string) => {
    const current = tapped[playerId] ?? []
    const next = current.includes(dotId) ? current.filter((d) => d !== dotId) : [...current, dotId]
    onChange({ ...tapped, [playerId]: next })
  }

  return (
    <section className="stack stack-3 stage">
      <div>
        <h2 className="stage__prompt">Anything extra?</h2>
        <p className="stage__hint">Birdies and eagles are counted for you. Tap the rest.</p>
      </div>

      {round.players.map((player) => {
        const strokes = entry?.scores[player.id]
        const chosen = tapped[player.id] ?? []
        return (
          <div key={player.id} className="stack stack-2">
            <div className="row">
              <Avatar player={player} size="sm" />
              <span style={{ fontWeight: 700 }}>{player.name}</span>
              {strokes != null && (
                <span className="chip">{scoreName(strokes, hole.par)}</span>
              )}
            </div>
            <div className="dotgrid">
              {dots.map((dot) => {
                const on = chosen.includes(dot.id)
                return (
                  <button
                    key={dot.id}
                    className={`dotchip${on ? ' is-on' : ''}${dot.points < 0 ? ' is-negative' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggle(player.id, dot.id)}
                  >
                    <span aria-hidden>{dot.emoji}</span>
                    <span className="dotchip__name">{dot.name}</span>
                    <span className="dotchip__val">{dot.points > 0 ? `+${dot.points}` : dot.points}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
