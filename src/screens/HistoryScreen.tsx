import { GAMES } from '../games/registry'
import { useRouter } from '../state/router'
import { useStore } from '../state/store'
import { AppBar } from '../ui/components'
import { EmptyGreen } from '../ui/art'
import { Trash } from '../ui/icons'

export function HistoryScreen() {
  const { go } = useRouter()
  const { rounds, deleteRound } = useStore()

  if (!rounds.length) {
    return (
      <div className="page">
        <AppBar title="Rounds" />
        <div className="empty">
          <EmptyGreen className="empty__art" />
          <h2 className="empty__title">No rounds yet</h2>
          <p className="empty__text">Your first match starts on the first tee.</p>
          <button className="btn btn--primary" onClick={() => go('/games')}>
            Start a round
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <AppBar title="Rounds" />
      <div className="stack stack-3">
        {rounds.map((r) => {
          const game = GAMES.find((g) => g.meta.id === r.gameId)
          const played = r.entries.filter((e) => e.complete).length
          return (
            <div key={r.id} className="row" style={{ gap: 'var(--s-2)' }}>
              <button
                className="card card--interactive grow"
                onClick={() => go(r.status === 'active' ? `/play?round=${r.id}` : `/results?round=${r.id}`)}
              >
                <div className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <div className="t-head">{game?.meta.name ?? r.gameId}</div>
                    <div className="t-sm muted">
                      {new Date(r.createdAt).toLocaleDateString()} · {r.players.map((p) => p.name).join(', ')}
                    </div>
                  </div>
                  <span className={`chip ${r.status === 'active' ? 'chip--good' : ''}`}>
                    {r.status === 'active' ? `Hole ${r.currentHole}` : `${played} holes`}
                  </span>
                </div>
              </button>
              <button
                className="iconbtn iconbtn--ghost"
                aria-label={`Delete round`}
                onClick={() => deleteRound(r.id)}
              >
                <Trash size={20} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
