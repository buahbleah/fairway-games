import type { FinalResult, Player, Round } from '../core/types'
import { GAME_MARKS } from '../ui/icons'
import { BrandMark } from '../ui/art'

/**
 * The share card. Designed to be screenshotted and dropped into a group chat,
 * so it has to survive being cropped and read at thumbnail size: big winner,
 * clean list, brand mark small and bottom-right.
 */
export function ShareCard({
  round,
  result,
  players,
  variant = 'leaderboard',
}: {
  round: Round
  result: FinalResult
  players: Player[]
  variant?: 'leaderboard' | 'winner'
}) {
  const Mark = GAME_MARKS[round.gameId]
  const gameName = round.gameId
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
  const date = new Date(round.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
  const holes = round.entries.filter((e) => e.complete).length
  const winnerNames = result.winners
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(' + ')

  return (
    <div className="sharecard-art">
      <svg className="sharecard-art__bg" viewBox="0 0 360 200" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke="#c79a4b" strokeOpacity=".2" strokeWidth="1.2">
          <path d="M-10 150c60-40 120-46 180-20s110 12 200-34" />
          <path d="M-10 172c62-44 126-50 188-22s112 10 192-40" />
          <path d="M-10 128c56-36 108-40 160-18s104 8 210-30" />
        </g>
      </svg>

      <header className="sharecard-art__head">
        <span className="sharecard-art__game">
          <Mark size={16} /> {gameName}
        </span>
        <span className="sharecard-art__date">{date}</span>
      </header>

      {variant === 'winner' ? (
        <div className="sharecard-art__hero">
          <div className="label" style={{ color: 'var(--sand-300)' }}>
            {result.winners.length > 1 ? 'Winners' : 'Winner'}
          </div>
          <div className="sharecard-art__winner">{winnerNames || '—'}</div>
          {result.subhead && <div className="sharecard-art__score num">{result.subhead}</div>}
        </div>
      ) : (
        <ol className="sharecard-art__list">
          {result.standings.map((row) => {
            const player = players.find((p) => p.id === row.playerId)
            if (!player) return null
            const leader = row.rank === 1
            return (
              <li key={row.playerId} className={`sharecard-art__row${leader ? ' is-leader' : ''}`}>
                <span className="sharecard-art__rank num">{row.rank}</span>
                <span className="grow">{player.name}</span>
                <span className="num">{row.display}</span>
              </li>
            )
          })}
        </ol>
      )}

      <footer className="sharecard-art__foot">
        <span>
          {holes} {holes === 1 ? 'hole' : 'holes'} · {players.length} players
        </span>
        <span className="row" style={{ gap: 6 }}>
          <BrandMark size={18} />
          Fairway Games
        </span>
      </footer>
    </div>
  )
}
