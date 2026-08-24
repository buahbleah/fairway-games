import { GAMES } from '../games/registry'
import { useRouter } from '../state/router'
import { AppBar, Rating } from '../ui/components'
import { GAME_MARKS, PlayerIcon } from '../ui/icons'

export function GameSelectScreen() {
  const { go } = useRouter()
  return (
    <div className="page">
      <AppBar title="Choose Your Game" />
      <div className="stack stack-3" style={{ paddingTop: 'var(--s-2)' }}>
        <p className="t-sm muted" style={{ marginBottom: 'var(--s-1)' }}>
          Six ways to play. Tap How it works if the format is new to you — every game is explained
          before you tee off.
        </p>

        {GAMES.map((game) => {
          const Mark = GAME_MARKS[game.meta.id]
          return (
            <article
              key={game.meta.id}
              className="gamecard anim-enter"
              style={
                {
                  '--tile': `var(--game-${game.meta.accent})`,
                  '--tile-soft': `var(--game-${game.meta.accent}-soft)`,
                } as React.CSSProperties
              }
            >
              <div className="gamecard__top">
                <span className="gamecard__mark">
                  <Mark size={28} />
                </span>
                <div className="grow">
                  <h2 className="gamecard__title">{game.meta.name}</h2>
                  <div className="gamecard__meta">
                    <span className="row" style={{ gap: 4 }}>
                      <PlayerIcon size={14} />
                      {game.meta.playersLabel}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{game.meta.complexityLabel} to learn</span>
                    <span aria-hidden>·</span>
                    <Rating value={game.meta.strategy} label="Strategy" />
                  </div>
                </div>
              </div>

              <p className="gamecard__desc">{game.meta.tagline}</p>

              <div className="gamecard__actions">
                <button className="btn btn--secondary" onClick={() => go(`/game/${game.meta.id}`)}>
                  How it works
                </button>
                <button className="btn btn--primary" onClick={() => go(`/setup?game=${game.meta.id}`)}>
                  Play
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
