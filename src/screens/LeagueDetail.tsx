import { useEffect, useState } from 'react'
import { api, type LeagueDetail as LeagueDetailPayload } from '../net/api'
import { useRouter } from '../state/router'
import { AppBar, Avatar, useToast } from '../ui/components'
import { GAMES } from '../games/registry'
import { GAME_MARKS } from '../ui/icons'

/** One league: who is in it, and every round the group has played. */
export function LeagueDetailScreen({ leagueId }: { leagueId: string }) {
  const { go } = useRouter()
  const { showToast, toastNode } = useToast()
  const [data, setData] = useState<LeagueDetailPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .league(leagueId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load that league.'))
    return () => {
      cancelled = true
    }
  }, [leagueId])

  if (error) {
    return (
      <div className="page">
        <AppBar title="League" />
        <div className="empty">
          <p className="empty__title">{error}</p>
          <button className="btn btn--primary" onClick={() => go('/leagues')}>
            Back to leagues
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <AppBar title="League" />
        <p className="t-sm muted">Loading…</p>
      </div>
    )
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.league.joinCode)
      showToast({ message: 'Join code copied' })
    } catch {
      showToast({ message: `Join code: ${data.league.joinCode}` })
    }
  }

  return (
    <div className="page">
      <AppBar title={data.league.name} />

      <div className="stack stack-5">
        <button className="card card--interactive" onClick={copyCode}>
          <div className="row-between">
            <div>
              <div className="label">Join code</div>
              <div className="t-title" style={{ letterSpacing: '0.2em' }}>
                {data.league.joinCode}
              </div>
            </div>
            <span className="chip">Tap to copy</span>
          </div>
        </button>

        <section className="stack stack-2">
          <h2 className="section-title">Members ({data.members.length})</h2>
          {data.members.map((m) => (
            <div key={m.id} className="card card--tight row" style={{ gap: 'var(--s-3)' }}>
              <Avatar player={{ ...m }} size="sm" />
              <span className="grow">
                <span style={{ fontWeight: 700, display: 'block' }}>{m.name}</span>
                <span className="t-sm muted">
                  {m.handicapIndex != null ? `HCP ${m.handicapIndex.toFixed(1)}` : 'No handicap set'}
                </span>
              </span>
              {m.role === 'owner' && <span className="chip chip--accent">Owner</span>}
            </div>
          ))}
        </section>

        <section className="stack stack-2">
          <h2 className="section-title">Rounds ({data.rounds.length})</h2>
          {data.rounds.length === 0 ? (
            <p className="t-sm muted">
              No rounds in this league yet. Start one and pick this league in Round Setup.
            </p>
          ) : (
            data.rounds.map((r) => {
              const game = GAMES.find((g) => g.meta.id === r.gameId)
              const Mark = game ? GAME_MARKS[game.meta.id] : null
              return (
                <button
                  key={r.id}
                  className="card card--interactive"
                  onClick={() => go(r.status === 'active' ? `/play?round=${r.id}` : `/results?round=${r.id}`)}
                >
                  <div className="row" style={{ gap: 'var(--s-3)' }}>
                    {Mark && game && (
                      <span
                        className="resume__mark"
                        style={{
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          background: `var(--game-${game.meta.accent}-soft)`,
                          color: `var(--game-${game.meta.accent})`,
                        }}
                      >
                        <Mark size={22} />
                      </span>
                    )}
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>
                        {game?.meta.name ?? r.gameId}
                      </span>
                      <span className="t-sm muted">
                        {new Date(r.createdAt).toLocaleDateString()} ·{' '}
                        {r.players.map((p) => p.name).join(', ')}
                      </span>
                    </span>
                    <span className={`chip ${r.status === 'active' ? 'chip--good' : ''}`}>
                      {r.status === 'active' ? `Hole ${r.currentHole}` : `${r.holesPlayed} holes`}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </section>
      </div>

      <div className="actionbar">
        <button className="btn btn--primary btn--xl" onClick={() => go(`/games?league=${leagueId}`)}>
          Start a league round
        </button>
      </div>

      {toastNode}
    </div>
  )
}
