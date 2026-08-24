import { useEffect, useMemo, useState } from 'react'
import { getGame } from '../games/registry'
import { useRouter } from '../state/router'
import { useStore } from '../state/store'
import { AppBar, Leaderboard, Segmented, Sheet, useToast } from '../ui/components'
import { ResultHero } from '../ui/art'
import { Share, Trophy } from '../ui/icons'
import { HoleLog, ScorecardTable } from './Play'
import { ShareCard } from './ShareCard'
import type { GameContext } from '../core/types'

export function ResultsScreen() {
  const { route, go } = useRouter()
  const store = useStore()
  const round = store.getRound(route.params.round ?? '')
  const { showToast, toastNode } = useToast()
  const [sheet, setSheet] = useState<null | 'card' | 'log' | 'share'>(null)
  const [shareVariant, setShareVariant] = useState<'leaderboard' | 'winner'>('leaderboard')

  useEffect(() => {
    if (round && round.status === 'active') store.finishRound(round.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id])

  const data = useMemo(() => {
    if (!round) return null
    const game = getGame(round.gameId)
    const ctx: GameContext = {
      players: round.players,
      course: round.course,
      settings: round.settings,
      gameState: round.gameState,
    }
    return { game, ctx, result: game.finalResult(ctx, round.entries) }
  }, [round])

  if (!round || !data) {
    return (
      <div className="page">
        <AppBar title="Result" />
        <div className="empty">
          <p className="empty__title">Nothing here</p>
          <button className="btn btn--primary" onClick={() => go('/')}>
            Back home
          </button>
        </div>
      </div>
    )
  }

  const { game, result } = data
  const holes = round.entries.filter((e) => e.complete).length

  const shareText = [
    `${game.meta.name} · ${new Date(round.createdAt).toLocaleDateString()}`,
    ...result.standings.map((s, i) => `${i + 1}. ${round.players.find((p) => p.id === s.playerId)?.name} ${s.display}`),
    `${holes} holes · Fairway Games`,
  ].join('\n')

  const copyText = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${game.meta.name} result`, text: shareText })
        return
      }
      await navigator.clipboard.writeText(shareText)
      showToast({ message: 'Result copied' })
    } catch {
      showToast({ message: 'Could not share — screenshot the card instead' })
    }
  }

  return (
    <div className="page">
      <AppBar title="Result" onBack={() => go('/')} />

      <section className="result-hero">
        <ResultHero />
        <div className="result-hero__label">
          {result.winners.length > 1 ? "Today's winners" : "Today's winner"}
        </div>
        <div className="result-hero__name">{result.headline}</div>
        {result.subhead && <div className="result-hero__score num">{result.subhead}</div>}
      </section>

      <div className="stack stack-5" style={{ marginTop: 'var(--s-5)' }}>
        <Leaderboard standings={result.standings} players={round.players} />

        {result.lines.length > 0 && (
          <section className="card stack stack-2">
            <h3 className="section-title">How it finished</h3>
            {result.lines.map((line, i) => (
              <p key={i} className="t-sm">
                {line}
              </p>
            ))}
          </section>
        )}

        <div className="statgrid">
          <div className="stat">
            <div className="stat__label">Holes</div>
            <div className="stat__value">{holes}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Players</div>
            <div className="stat__value">{round.players.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Game</div>
            <div className="stat__value" style={{ fontSize: 'var(--text-base)' }}>
              {game.meta.name}
            </div>
          </div>
        </div>

        <div className="stack stack-2">
          <button className="btn btn--secondary btn--block" onClick={() => setSheet('log')}>
            Hole by hole
          </button>
          <button className="btn btn--secondary btn--block" onClick={() => setSheet('card')}>
            Scorecard
          </button>
          <button className="btn btn--secondary btn--block" onClick={() => setSheet('share')}>
            <Share size={18} /> Share result
          </button>
          {round.status === 'finished' && (
            <button
              className="btn btn--quiet btn--block"
              onClick={() => {
                store.reopenRound(round.id)
                go(`/play?round=${round.id}`)
              }}
            >
              Reopen this round
            </button>
          )}
        </div>
      </div>

      <div className="actionbar">
        <button className="btn btn--primary btn--xl" onClick={() => go('/games')}>
          <Trophy size={18} /> Play again
        </button>
      </div>

      <Sheet open={sheet === 'log'} onClose={() => setSheet(null)} title="Hole by hole">
        <HoleLog round={round} />
      </Sheet>
      <Sheet open={sheet === 'card'} onClose={() => setSheet(null)} title="Scorecard">
        <ScorecardTable round={round} />
      </Sheet>
      <Sheet open={sheet === 'share'} onClose={() => setSheet(null)} title="Share">
        <div className="stack stack-4">
          <Segmented
            ariaLabel="Card style"
            value={shareVariant}
            onChange={setShareVariant}
            options={[
              { value: 'leaderboard', label: 'Leaderboard' },
              { value: 'winner', label: 'Winner' },
            ]}
          />
          <ShareCard round={round} result={result} players={round.players} variant={shareVariant} />
          <p className="t-sm muted center">Screenshot the card, or send the result as text.</p>
          <button className="btn btn--primary btn--block" onClick={copyText}>
            <Share size={18} /> Send as text
          </button>
        </div>
      </Sheet>
      {toastNode}
    </div>
  )
}
