import { useEffect, useState } from 'react'
import { GAMES } from '../games/registry'
import { useRouter } from '../state/router'
import { useStore } from '../state/store'
import { useAccount } from '../state/account'
import { api, type RoundSummary } from '../net/api'
import { BrandMark, ContourBackdrop } from '../ui/art'
import {
  GAME_MARKS,
  History as HistoryIcon,
  PlayerIcon,
  Settings as SettingsIcon,
  Trophy,
} from '../ui/icons'

function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 11) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeScreen() {
  const { go } = useRouter()
  const { rounds, activeRound } = useStore()
  const { account, invites, refreshInvites } = useAccount()
  const [liveRounds, setLiveRounds] = useState<RoundSummary[]>([])

  useEffect(() => {
    if (!account) {
      setLiveRounds([])
      return
    }
    const load = () =>
      api
        .rounds()
        .then((d) => setLiveRounds(d.rounds.filter((r) => r.status === 'active')))
        .catch(() => {
          /* offline — keep showing what we had */
        })

    void load()
    void refreshInvites()

    // Coming back to the app has to show what happened while it was away.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void load()
      void refreshInvites()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [account, refreshInvites])

  const finished = rounds.filter((r) => r.status === 'finished')
  const resumeGame = activeRound ? GAMES.find((g) => g.meta.id === activeRound.gameId) : null
  const holesPlayed = activeRound?.entries.filter((e) => e.complete).length ?? 0
  const holesTotal = activeRound?.course.holes.length ?? 18
  const ResumeMark = resumeGame ? GAME_MARKS[resumeGame.meta.id] : null
  const waiting = invites?.total ?? 0

  const joinRound = async (roundId: string, inviteId: string) => {
    try {
      await api.joinRound(roundId)
      await refreshInvites()
      go(`/play?round=${roundId}`)
    } catch {
      go(`/play?round=${roundId}`)
    }
    void inviteId
  }

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
              <button
                className="iconbtn"
                style={{ color: 'inherit' }}
                onClick={() => go('/history')}
                aria-label="Round history"
              >
                <HistoryIcon />
              </button>
              <button
                className="iconbtn"
                style={{ color: 'inherit' }}
                onClick={() => go('/settings')}
                aria-label="Settings"
              >
                <SettingsIcon />
                {waiting > 0 && <span className="badge">{waiting}</span>}
              </button>
            </div>
          </div>

          <div className="stack stack-2">
            <h1 className="home-hero__greeting">
              {greeting()}
              {account ? `, ${account.name.split(' ')[0]}` : ''}
            </h1>
            <p className="home-hero__sub">
              {activeRound || liveRounds.length ? 'You have a round on the go.' : 'Ready for another round?'}
            </p>
          </div>

          <button className="btn btn--primary btn--xl btn--block" onClick={() => go('/games')}>
            Start Round
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------- invitations */}
      {invites && invites.rounds.length > 0 && (
        <section className="stack stack-3" style={{ marginBottom: 'var(--s-6)' }}>
          <h2 className="section-title">You are invited</h2>
          {invites.rounds.map((inv) => {
            const game = GAMES.find((g) => g.meta.id === inv.gameId)
            return (
              <button key={inv.id} className="invite" onClick={() => joinRound(inv.roundId, inv.id)}>
                <span className="invite__mark">
                  <Trophy size={22} />
                </span>
                <span className="grow">
                  <span style={{ fontWeight: 700, display: 'block' }}>
                    {game?.meta.name ?? inv.gameId}
                    {inv.leagueName ? ` · ${inv.leagueName}` : ''}
                  </span>
                  <span className="t-sm muted">{inv.invitedBy} asked you to play</span>
                </span>
                <span className="chip chip--accent">Join</span>
              </button>
            )
          })}
        </section>
      )}

      {invites && invites.friends.length > 0 && (
        <section className="stack stack-3" style={{ marginBottom: 'var(--s-6)' }}>
          <h2 className="section-title">Friend requests</h2>
          <button className="invite" onClick={() => go('/friends')}>
            <span className="invite__mark">
              <PlayerIcon size={22} />
            </span>
            <span className="grow">
              <span style={{ fontWeight: 700, display: 'block' }}>
                {invites.friends.length} waiting
              </span>
              <span className="t-sm muted">{invites.friends.map((f) => f.name).join(', ')}</span>
            </span>
            <span className="chip chip--accent">Open</span>
          </button>
        </section>
      )}

      {/* ------------------------------------------------------------ resume */}
      {(activeRound || liveRounds.length > 0) && (
        <section className="stack stack-3" style={{ marginBottom: 'var(--s-6)' }}>
          <h2 className="section-title">Continue playing</h2>

          {liveRounds.map((r) => {
            const game = GAMES.find((g) => g.meta.id === r.gameId)
            const Mark = game ? GAME_MARKS[game.meta.id] : null
            if (!game || !Mark) return null
            return (
              <button key={r.id} className="resume" onClick={() => go(`/play?round=${r.id}`)}>
                <span
                  className="resume__mark"
                  style={{
                    background: `var(--game-${game.meta.accent}-soft)`,
                    color: `var(--game-${game.meta.accent})`,
                  }}
                >
                  <Mark size={26} />
                </span>
                <span className="grow">
                  <span className="t-head" style={{ display: 'block' }}>
                    {game.meta.name}
                  </span>
                  <span className="t-sm muted">
                    Hole {r.currentHole} · {r.players.map((p) => p.name).join(', ')}
                  </span>
                </span>
                <span className="chip chip--good">
                  <span className="livedot is-live" aria-hidden /> Live
                </span>
              </button>
            )
          })}

          {activeRound && resumeGame && ResumeMark && (
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
                  Hole {activeRound.currentHole} of {holesTotal} · on this phone
                </span>
                <span className="resume__meter">
                  <span style={{ width: `${Math.round((holesPlayed / holesTotal) * 100)}%` }} />
                </span>
              </span>
              <span className="chip">Resume</span>
            </button>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------- games */}
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

      {/* -------------------------------------------------- friends + leagues */}
      <section className="stack stack-3" style={{ marginBottom: 'var(--s-6)' }}>
        <h2 className="section-title">Your group</h2>
        {account ? (
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <button className="btn btn--secondary grow" onClick={() => go('/friends')}>
              <PlayerIcon size={18} /> Friends
            </button>
            <button className="btn btn--secondary grow" onClick={() => go('/leagues')}>
              <Trophy size={18} /> Leagues
            </button>
          </div>
        ) : (
          <button className="card card--interactive" onClick={() => go('/account')}>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <span className="resume__mark">
                <PlayerIcon size={22} />
              </span>
              <span className="grow">
                <span style={{ fontWeight: 700, display: 'block' }}>Play with your group</span>
                <span className="t-sm muted">
                  Sign in to add friends, run a league and score together on every phone.
                </span>
              </span>
            </div>
          </button>
        )}
      </section>

      {finished.length > 0 && (
        <section className="stack stack-3">
          <h2 className="section-title">Recent rounds</h2>
          {finished.slice(0, 3).map((r) => {
            const game = GAMES.find((g) => g.meta.id === r.gameId)
            return (
              <button
                key={r.id}
                className="card card--tight card--interactive"
                onClick={() => go(`/results?round=${r.id}`)}
              >
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 700 }}>{game?.meta.name ?? r.gameId}</div>
                    <div className="t-sm muted">
                      {new Date(r.createdAt).toLocaleDateString()} ·{' '}
                      {r.players.map((p) => p.name).join(', ')}
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
