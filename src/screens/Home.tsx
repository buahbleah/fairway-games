import { GAMES } from '../games/registry'
import { useRouter } from '../state/router'
import { useStore } from '../state/store'
import { BrandMark, ContourBackdrop } from '../ui/art'
import { GAME_MARKS, History as HistoryIcon, Settings as SettingsIcon } from '../ui/icons'

function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 11) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeScreen() {
  const { go } = useRouter()
  const { rounds, activeRound } = useStore()
  const finished = rounds.filter((r) => r.status === 'finished')
  const resumeGame = activeRound ? GAMES.find((g) => g.meta.id === activeRound.gameId) : null
  const holesPlayed = activeRound?.entries.filter((e) => e.complete).length ?? 0
  const holesTotal = activeRound?.course.holes.length ?? 18
  const ResumeMark = resumeGame ? GAME_MARKS[resumeGame.meta.id] : null

  return (
    <div className="page">
      <section className="home-hero bleed">
        <ContourBackdrop />
        <div className="home-hero__inner">
          <div className="home-hero__brandrow">
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <BrandMark size={30} />
              <span className="home-hero__wordmark">Fairway Games</span>
            </div>
            <div className="row" style={{ gap: 0 }}>
              <button className="iconbtn" style={{ color: 'inherit' }} onClick={() => go('/history')} aria-label="Round history">
                <HistoryIcon />
              </button>
              <button className="iconbtn" style={{ color: 'inherit' }} onClick={() => go('/settings')} aria-label="Settings">
                <SettingsIcon />
              </button>
            </div>
          </div>

          <div className="stack stack-2">
            <h1 className="home-hero__greeting">{greeting()}</h1>
            <p className="home-hero__sub">
              {activeRound ? 'You have a round on the go.' : 'Ready for another round?'}
            </p>
          </div>

          <button className="btn btn--primary btn--xl btn--block" onClick={() => go('/games')}>
            Start Round
          </button>
        </div>
      </section>

      {activeRound && resumeGame && ResumeMark && (
        <section className="stack stack-3" style={{ marginBottom: 'var(--s-6)' }}>
          <h2 className="section-title">Continue playing</h2>
          <button className="resume" onClick={() => go(`/play?round=${activeRound.id}`)}>
            <span
              className="resume__mark"
              style={{
                background: `var(--game-${resumeGame.meta.accent}-soft)`,
                color: `var(--game-${resumeGame.meta.accent})`,
              }}
            >
              <ResumeMark size={26} />
            </span>
            <span className="grow">
              <span className="t-head" style={{ display: 'block' }}>
                {resumeGame.meta.name}
              </span>
              <span className="t-sm muted">
                Hole {activeRound.currentHole} of {holesTotal} · {activeRound.players.length} players
              </span>
              <span className="resume__meter">
                <span style={{ width: `${Math.round((holesPlayed / holesTotal) * 100)}%` }} />
              </span>
            </span>
            <span className="chip chip--good">Resume</span>
          </button>
        </section>
      )}

      <section className="stack stack-3" style={{ marginBottom: 'var(--s-6)' }}>
        <h2 className="section-title">Games</h2>
        <div className="gamegrid">
          {GAMES.map((game) => {
            const Mark = GAME_MARKS[game.meta.id]
            return (
              <button
                key={game.meta.id}
                className="gametile"
                style={
                  {
                    '--tile': `var(--game-${game.meta.accent})`,
                    '--tile-soft': `var(--game-${game.meta.accent}-soft)`,
                  } as React.CSSProperties
                }
                onClick={() => go(`/game/${game.meta.id}`)}
              >
                <span className="gametile__mark">
                  <Mark size={24} />
                </span>
                <span className="gametile__name">{game.meta.name}</span>
                <span className="gametile__tag">{game.meta.tagline}</span>
              </button>
            )
          })}
        </div>
      </section>

      {finished.length > 0 && (
        <section className="stack stack-3">
          <h2 className="section-title">Recent rounds</h2>
          {finished.slice(0, 3).map((r) => {
            const game = GAMES.find((g) => g.meta.id === r.gameId)
            return (
              <button key={r.id} className="card card--tight card--interactive" onClick={() => go(`/results?round=${r.id}`)}>
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 700 }}>{game?.meta.name ?? r.gameId}</div>
                    <div className="t-sm muted">
                      {new Date(r.createdAt).toLocaleDateString()} · {r.players.map((p) => p.name).join(', ')}
                    </div>
                  </div>
                  <span className="chip">{r.entries.filter((e) => e.complete).length} holes</span>
                </div>
              </button>
            )
          })}
          <button className="btn btn--quiet" onClick={() => go('/history')}>
            See all rounds
          </button>
        </section>
      )}
    </div>
  )
}
