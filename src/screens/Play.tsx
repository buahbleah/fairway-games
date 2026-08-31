import { useEffect, useMemo, useState } from 'react'
import { getGame } from '../games/registry'
import { getHud } from '../games/hudRegistry'
import { useRouter } from '../state/router'
import { haptic, useStore } from '../state/store'
import { useRoundController, type RoundController } from '../state/roundController'
import { upFromRound } from '../state/navigation'
import type { SyncState } from '../state/onlineRound'
import { api } from '../net/api'
import { AppBar, Avatar, Leaderboard, Sheet, useToast } from '../ui/components'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  History as HistoryIcon,
  PlayerIcon,
  Scorecard,
  Trash,
  Trophy,
  Undo,
} from '../ui/icons'
import { holeByNumber, scoreName } from '../core/course'
import { netContextFrom } from '../core/scoring'
import { strokesOnHole } from '../core/handicap'
import type { GameContext, HoleEntry, PlayerId, Round } from '../core/types'
import { WolfPickStage, describeWolfPick } from '../games/wolf/pickStage'
import type { WolfHolePayload } from '../games/wolf'
import { TeamsStage } from '../games/team_match_play/teamsStage'
import { DotsStage } from '../games/dots/dotsStage'

type Stage = 'pick' | 'teams' | 'score' | 'extras' | 'result'


export function PlayScreen() {
  const { route, go, up } = useRouter()
  const store = useStore()
  const requested = route.params.round ?? null
  const roundId = requested ?? store.activeRound?.id ?? null
  const ctrl = useRoundController(roundId)

  if (ctrl.loading && !ctrl.round) {
    return (
      <div className="page">
        <AppBar title="Round" onBack={() => up(upFromRound(ctrl.round))} />
        <div className="empty">
          <p className="empty__text">Catching up with the round…</p>
        </div>
      </div>
    )
  }

  if (!ctrl.round) {
    return (
      <div className="page">
        <AppBar title="Round" onBack={() => up(upFromRound(ctrl.round))} />
        <div className="empty">
          <p className="empty__title">That round has gone</p>
          <p className="empty__text">
            {ctrl.error ?? 'It may have been deleted. Start a new one from the home screen.'}
          </p>
          <button className="btn btn--primary" onClick={() => go('/')}>
            Back home
          </button>
        </div>
      </div>
    )
  }

  return <PlayRound key={ctrl.round.id} ctrl={ctrl} round={ctrl.round} />
}

/** Rendered only once a round exists, so every hook below is unconditional. */
function PlayRound({ ctrl, round }: { ctrl: RoundController; round: Round }) {
  const { go, up } = useRouter()
  const store = useStore()
  const { showToast, toastNode } = useToast()
  const [sheet, setSheet] = useState<null | 'board' | 'history' | 'card' | 'menu' | 'invite' | 'leave'>(null)
  const [leaving, setLeaving] = useState(false)

  const game = getGame(round.gameId)
  const ctx: GameContext = {
    players: round.players,
    course: round.course,
    settings: round.settings,
    gameState: round.gameState,
  }
  const computed = useMemo(() => game.compute(ctx, round.entries), [game, round])
  const hole = holeByNumber(round.course, round.currentHole)
  const entry = round.entries.find((e) => e.hole === round.currentHole)
  const holeNumbers = round.course.holes.map((h) => h.number)
  const isLastHole = round.currentHole === holeNumbers[holeNumbers.length - 1]
  const allComplete = round.entries.filter((e) => e.complete).length >= holeNumbers.length

  const Hud = getHud(round.gameId)

  /* ------------------------------------------------------------- stages */

  const hasPick = game.preScoreStage === 'wolfPick' && !!entry?.game?.mode
  const needsPick = game.preScoreStage === 'wolfPick' && !entry?.game?.mode
  const needsTeams =
    game.preScoreStage === 'teams' &&
    round.settings.teamRotation === 'six' &&
    (round.currentHole - 1) % 6 === 0 &&
    !entry?.game?.teamsConfirmed
  const hasExtras = round.gameId === 'dots'

  const [stage, setStage] = useState<Stage>('score')
  /** Where a re-opened pick should return to, so editing never loses your place. */
  const [pickReturn, setPickReturn] = useState<Stage>('score')
  useEffect(() => {
    if (entry?.complete) setStage('result')
    else if (needsPick) setStage('pick')
    else if (needsTeams) setStage('teams')
    else setStage('score')
    // Only re-evaluate when the hole itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.currentHole, round.id])

  const patchEntry = (patch: Partial<HoleEntry>) => ctrl.patchEntry(round.currentHole, patch)

  const goHole = (n: number) => {
    if (!holeNumbers.includes(n)) return
    ctrl.goToHole(n)
  }

  const finishHole = () => {
    ctrl.completeHole(round.currentHole)
    haptic('success', store.prefs.haptics)
    setStage('result')
  }

  const doUndo = () => {
    const label = ctrl.undo()
    if (label) showToast({ message: `Undone — ${label}` })
    setStage('score')
  }

  return (
    <div className="page">
      <AppBar
        title={game.meta.name}
        onBack={() => setSheet('leave')}
        right={
          <div className="row" style={{ gap: 0 }}>
            {ctrl.canUndo && (
              <button className="iconbtn" onClick={doUndo} aria-label="Undo last change">
                <Undo />
              </button>
            )}
            <button className="iconbtn" onClick={() => setSheet('board')} aria-label="Leaderboard">
              <Trophy />
            </button>
            <button className="iconbtn" onClick={() => setSheet('menu')} aria-label="Round menu">
              <Scorecard />
            </button>
          </div>
        }
      />

      {ctrl.online && <SyncBadge sync={ctrl.sync} pending={ctrl.pending} players={round.players.length} />}

      <header className="holehead">
        <div>
          <div className="label">Hole</div>
          <div className="holehead__num num">{round.currentHole}</div>
          <div className="holehead__par">
            Par {hole.par} · SI {hole.strokeIndex}
          </div>
        </div>
        <div className="holehead__nav">
          <button
            className="iconbtn"
            onClick={() => goHole(round.currentHole - 1)}
            disabled={round.currentHole <= holeNumbers[0]}
            aria-label="Previous hole"
          >
            <ChevronLeft />
          </button>
          <button
            className="iconbtn"
            onClick={() => goHole(round.currentHole + 1)}
            disabled={isLastHole}
            aria-label="Next hole"
          >
            <ChevronRight />
          </button>
        </div>
      </header>

      {computed.status.length > 0 && (
        <div className="statusstrip" style={{ marginBottom: 'var(--s-4)' }}>
          {computed.status.map((chip, i) => (
            <span
              key={i}
              className={`chip${chip.tone === 'good' ? ' chip--good' : chip.tone === 'bad' ? ' chip--bad' : chip.tone === 'accent' ? ' chip--accent' : ''}`}
            >
              {chip.label && <span className="label" style={{ color: 'inherit', opacity: 0.75 }}>{chip.label}</span>}
              <strong>{chip.value}</strong>
            </span>
          ))}
        </div>
      )}

      {/* During the Wolf pick the stage itself names the Wolf, so the HUD would
          only repeat it. One thing on screen at a time. */}
      {Hud && stage !== 'pick' && (
        <Hud
          round={round}
          ctx={ctx}
          computed={computed}
          stage={stage}
          patchEntry={patchEntry}
          patchGameState={(patch) => ctrl.patchGameState(patch)}
        />
      )}

      <div className="stack stack-4" style={{ marginTop: 'var(--s-4)' }}>
        {/* A mis-tap on the tee should cost a tap to undo, not the whole hole. */}
        {hasPick && (stage === 'score' || stage === 'result') && (
          <div className="decisionbar">
            <span className="grow">
              <span className="decisionbar__label">Wolf took</span>
              <span className="decisionbar__value">
                {describeWolfPick(round, entry?.game as WolfHolePayload)}
              </span>
            </span>
            <button
              className="btn btn--quiet btn--sm"
              onClick={() => {
                setPickReturn(stage)
                setStage('pick')
              }}
            >
              Change
            </button>
          </div>
        )}

        {stage === 'pick' && (
          <WolfPickStage
            round={round}
            computed={computed}
            current={hasPick ? (entry?.game as WolfHolePayload) : null}
            onCancel={() => setStage(pickReturn)}
            onPick={(payload) => {
              // partnerId is written as null rather than left out. Online, the
              // server merges the hole's game object key by key, so an omitted
              // key keeps its old value — a switch from "partner" to "lone"
              // would leave the old partner sitting under it. The engine ignores
              // a partner on a lone hole either way, but the stored entry should
              // not say two contradictory things.
              patchEntry({
                game: {
                  ...(entry?.game ?? {}),
                  partnerId: null,
                  ...payload,
                },
              })
              haptic('medium', store.prefs.haptics)
              setStage(pickReturn)
            }}
          />
        )}

        {stage === 'teams' && (
          <TeamsStage
            round={round}
            ctx={ctx}
            onConfirm={() => {
              patchEntry({ game: { ...(entry?.game ?? {}), teamsConfirmed: true } })
              setStage('score')
            }}
          />
        )}

        {stage === 'score' && (
          <ScoreStage
            round={round}
            ctx={ctx}
            entry={entry}
            onScore={(playerId, value) => ctrl.setScore(round.currentHole, playerId, value)}
            onAdjust={(playerId, delta) =>
              ctrl.adjustScore(round.currentHole, playerId, delta, hole.par)
            }
          />
        )}

        {stage === 'extras' && (
          <DotsStage
            round={round}
            entry={entry}
            onChange={(dots) => patchEntry({ game: { ...(entry?.game ?? {}), dots } })}
          />
        )}

        {stage === 'result' && <HoleResult round={round} isLastHole={isLastHole} />}
      </div>

      <div className="actionbar">
        {stage === 'score' && (
          <button
            className="btn btn--primary btn--xl"
            disabled={!isReadyToScore(round, entry)}
            onClick={() => (hasExtras ? setStage('extras') : finishHole())}
          >
            {hasExtras ? 'Anything extra?' : entry?.complete ? 'Save changes' : 'Confirm hole'}
          </button>
        )}
        {stage === 'extras' && (
          <button className="btn btn--primary btn--xl" onClick={finishHole}>
            Done
          </button>
        )}
        {stage === 'result' && (
          <>
            <button className="btn btn--secondary" onClick={() => setStage('score')}>
              Edit
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                if (isLastHole || allComplete) go(`/results?round=${round.id}`)
                else goHole(round.currentHole + 1)
              }}
            >
              {isLastHole || allComplete ? 'Finish round' : `Hole ${round.currentHole + 1}`}
            </button>
          </>
        )}
      </div>

      {/* ---------------------------------------------------------- sheets */}

      <Sheet open={sheet === 'board'} onClose={() => setSheet(null)} title="Leaderboard">
        <Leaderboard standings={computed.standings} players={round.players} />
      </Sheet>

      <Sheet open={sheet === 'history'} onClose={() => setSheet(null)} title="Hole by hole">
        <HoleLog round={round} onPick={(h) => { goHole(h); setSheet(null) }} />
      </Sheet>

      <Sheet open={sheet === 'card'} onClose={() => setSheet(null)} title="Scorecard">
        <ScorecardTable round={round} />
      </Sheet>

      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title="Leave this round?">
        <div className="stack stack-3">
          <p className="t-sm muted">
            {round.leagueId
              ? 'You can pick it up again from the league whenever you like.'
              : 'You can pick it up again from the home screen whenever you like.'}
          </p>
          <button
            className="btn btn--primary btn--block"
            disabled={leaving}
            onClick={() => up(upFromRound(round))}
          >
            Keep it — resume later
          </button>
          <button className="btn btn--secondary btn--block" onClick={() => setSheet(null)}>
            Stay in the round
          </button>
          <hr className="divider" />
          <button
            className="btn btn--danger btn--block"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true)
              try {
                await ctrl.discard()
                up(upFromRound(round))
              } catch (err) {
                showToast({
                  message: err instanceof Error ? err.message : 'Could not delete that round.',
                })
                setLeaving(false)
              }
            }}
          >
            <Trash size={18} /> {leaving ? 'Deleting…' : 'Discard this round'}
          </button>
          <p className="t-sm muted center">Discarding removes it for everyone playing.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'invite'} onClose={() => setSheet(null)} title="Invite to this round">
        <InvitePanel roundId={round.id} onDone={(msg) => { showToast({ message: msg }); setSheet(null) }} />
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Round">
        <div className="stack stack-2">
          <button className="btn btn--secondary btn--block" onClick={() => setSheet('history')}>
            <HistoryIcon size={18} /> Hole by hole
          </button>
          <button className="btn btn--secondary btn--block" onClick={() => setSheet('card')}>
            <Scorecard size={18} /> Scorecard
          </button>
          {ctrl.online && (
            <button className="btn btn--secondary btn--block" onClick={() => setSheet('invite')}>
              <PlayerIcon size={18} /> Invite someone
            </button>
          )}
          <button className="btn btn--secondary btn--block" onClick={() => go(`/game/${round.gameId}`)}>
            How {game.meta.name} works
          </button>
          <button
            className="btn btn--primary btn--block"
            onClick={() => go(`/results?round=${round.id}`)}
          >
            <Trophy size={18} /> Finish round
          </button>
          <button className="btn btn--quiet btn--block" onClick={() => setSheet('leave')}>
            Leave without finishing
          </button>
        </div>
      </Sheet>

      {toastNode}
    </div>
  )
}

/* ------------------------------------------------------------ sync badge */

function SyncBadge({ sync, pending, players }: { sync: SyncState; pending: number; players: number }) {
  const label =
    sync === 'offline'
      ? pending
        ? `Offline · ${pending} to send`
        : 'Offline — scores are saved here'
      : sync === 'syncing'
        ? 'Saving…'
        : sync === 'error'
          ? 'Could not save — will retry'
          : `Live · ${players} players`
  const tone = sync === 'offline' ? 'chip--accent' : sync === 'error' ? 'chip--bad' : 'chip--good'
  return (
    <div className="row" style={{ marginBottom: 'var(--s-2)' }}>
      <span className={`chip ${tone}`}>
        <span className={`livedot${sync === 'idle' ? ' is-live' : ''}`} aria-hidden />
        {label}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------- invite panel */

function InvitePanel({ roundId, onDone }: { roundId: string; onDone: (message: string) => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.inviteToRound(roundId, email.trim())
      onDone(
        result.status === 'seated'
          ? 'They are in the round now.'
          : result.status === 'already-playing'
            ? 'They are already playing.'
            : 'Invite saved — it is waiting for them.',
      )
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that invite.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack stack-3">
      <p className="t-sm muted">
        Type their email. If they already have an account they join straight away and can score from
        their own phone. If not, the invite waits for them.
      </p>
      <input
        className="input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="friend@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>{error}</p>}
      <button className="btn btn--primary btn--block" disabled={!email.trim() || busy} onClick={send}>
        {busy ? 'Sending…' : 'Send invite'}
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- helpers */

function scoreTargets(round: Round): { id: PlayerId; label: string; sub?: string }[] {
  const isTeamSingleScore =
    round.gameId === 'team_match_play' && round.settings.format !== 'fourball'
  if (isTeamSingleScore) {
    const teams = (round.gameState.teams as PlayerId[][]) ?? []
    const names = (round.gameState.teamNames as string[]) ?? ['Team Green', 'Team Sand']
    return teams.map((team, i) => ({
      id: team[0],
      label: names[i],
      sub: team.map((id) => round.players.find((p) => p.id === id)?.name).join(' + '),
    }))
  }
  return round.players.map((p) => ({ id: p.id, label: p.name }))
}

function isReadyToScore(round: Round, entry: HoleEntry | undefined): boolean {
  if (!entry) return false
  return scoreTargets(round).every((t) => typeof entry.scores[t.id] === 'number')
}

/* ------------------------------------------------------------ score stage */

function ScoreStage({
  round,
  ctx,
  entry,
  onScore,
  onAdjust,
}: {
  round: Round
  ctx: GameContext
  entry: HoleEntry | undefined
  onScore: (playerId: PlayerId, value: number | null) => void
  onAdjust: (playerId: PlayerId, delta: number) => void
}) {
  const hole = holeByNumber(round.course, round.currentHole)
  const net = netContextFrom(ctx)
  const targets = scoreTargets(round)
  const scores: Record<PlayerId, number | null> =
    entry?.scores ?? Object.fromEntries(round.players.map((p) => [p.id, null]))

  const set = (id: PlayerId, value: number | null) => onScore(id, value)

  return (
    <section className="stack stack-3 stage">
      <div>
        <h2 className="stage__prompt">Scores</h2>
        <p className="stage__hint">Tap the number to jump straight to par.</p>
      </div>

      {targets.map((target) => {
        const player = round.players.find((p) => p.id === target.id)!
        const value = scores[target.id]
        const shots = net.useNet ? strokesOnHole(net.handicaps[target.id] ?? 0, hole, round.course.holes) : 0
        return (
          <div key={target.id} className={`scorerow${value == null ? '' : ' scorerow--active'}`}>
            <div className="row grow" style={{ minWidth: 0 }}>
              <Avatar player={player} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{target.label}</div>
                <div className="t-sm muted">
                  {target.sub ??
                    (value != null ? scoreName(value, hole.par) : 'No score yet')}
                  {shots > 0 && <span> · {shots} shot{shots > 1 ? 's' : ''}</span>}
                </div>
              </div>
            </div>
            <div className="stepper">
              <button
                className="stepper__btn"
                aria-label={`One less for ${target.label}`}
                onClick={() => onAdjust(target.id, -1)}
              >
                −
              </button>
              <button
                className={`stepper__value${value == null ? ' stepper__value--empty' : ''}`}
                onClick={() => set(target.id, hole.par)}
                aria-label={`Set ${target.label} to par`}
              >
                {value ?? hole.par}
              </button>
              <button
                className="stepper__btn"
                aria-label={`One more for ${target.label}`}
                onClick={() => onAdjust(target.id, +1)}
              >
                +
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

/* ----------------------------------------------------------- hole result */

function HoleResult({ round, isLastHole }: { round: Round; isLastHole: boolean }) {
  const game = getGame(round.gameId)
  const ctx: GameContext = {
    players: round.players,
    course: round.course,
    settings: round.settings,
    gameState: round.gameState,
  }
  const computed = game.compute(ctx, round.entries)
  const outcome = computed.outcomes.find((o) => o.hole === round.currentHole)
  const drama =
    round.gameId === 'wolf' &&
    ['lone', 'blind'].includes(round.entries.find((e) => e.hole === round.currentHole)?.game?.mode ?? '')

  if (!outcome) return null
  const gains = Object.entries(outcome.points).filter(([, v]) => v !== 0)

  return (
    <section className="stack stack-4 stage">
      <div className={`holeresult${drama ? ' holeresult--drama' : ''}`}>
        <div className="label" style={{ color: drama ? 'var(--sand-300)' : undefined }}>
          Hole {round.currentHole}
        </div>
        <div className="t-head" style={{ margin: 'var(--s-2) 0' }}>
          {outcome.headline}
        </div>
        {gains.length > 0 && (
          <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 'var(--s-3)' }}>
            {gains.map(([id, v]) => (
              <span key={id} className={`chip chip--lg ${v > 0 ? 'chip--good' : 'chip--bad'} anim-pop`}>
                {round.players.find((p) => p.id === id)?.name} {v > 0 ? `+${v}` : v}
              </span>
            ))}
          </div>
        )}
        {outcome.detail?.map((d, i) => (
          <p key={i} className="t-sm" style={{ opacity: 0.75, marginTop: 'var(--s-2)' }}>
            {d}
          </p>
        ))}
      </div>

      <Leaderboard standings={computed.standings} players={round.players} compact />

      <p className="t-sm muted center">
        {isLastHole ? 'That is the round.' : 'Anything wrong? Tap Edit — nothing is set in stone.'}
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- history */

export function HoleLog({ round, onPick }: { round: Round; onPick?: (hole: number) => void }) {
  const game = getGame(round.gameId)
  const ctx: GameContext = {
    players: round.players,
    course: round.course,
    settings: round.settings,
    gameState: round.gameState,
  }
  const computed = game.compute(ctx, round.entries)
  if (!computed.outcomes.length) return <p className="muted t-sm">No holes played yet.</p>

  return (
    <ol className="holelog">
      {[...computed.outcomes].reverse().map((o) => (
        <li key={o.hole}>
          <button className="holelog__item" onClick={() => onPick?.(o.hole)}>
            <span className="holelog__hole">{o.hole}</span>
            <span className="grow">
              <span className="holelog__headline">{o.headline}</span>
              {o.detail?.map((d, i) => (
                <span key={i} className="holelog__detail" style={{ display: 'block' }}>
                  {d}
                </span>
              ))}
            </span>
            {onPick && <Check size={18} className="faint" />}
          </button>
        </li>
      ))}
    </ol>
  )
}

/* -------------------------------------------------------------- scorecard */

export function ScorecardTable({ round }: { round: Round }) {
  const holes = round.course.holes
  return (
    <div className="scroll-x">
      <table className="scorecard">
        <thead>
          <tr>
            <th>Hole</th>
            {holes.map((h) => (
              <th key={h.number}>{h.number}</th>
            ))}
            <th>Tot</th>
          </tr>
          <tr>
            <th>Par</th>
            {holes.map((h) => (
              <th key={h.number}>{h.par}</th>
            ))}
            <th>{holes.reduce((t, h) => t + h.par, 0)}</th>
          </tr>
        </thead>
        <tbody>
          {round.players.map((p) => {
            const total = round.entries.reduce((t, e) => t + (e.scores[p.id] ?? 0), 0)
            return (
              <tr key={p.id}>
                <td>{p.name}</td>
                {holes.map((h) => {
                  const s = round.entries.find((e) => e.hole === h.number)?.scores[p.id]
                  const diff = s != null ? s - h.par : null
                  return (
                    <td
                      key={h.number}
                      style={{
                        fontWeight: diff != null && diff < 0 ? 700 : 400,
                        color: diff == null ? 'var(--text-faint)' : diff < 0 ? 'var(--good)' : diff > 1 ? 'var(--bad)' : undefined,
                      }}
                    >
                      {s ?? '·'}
                    </td>
                  )
                })}
                <td style={{ fontWeight: 700 }}>{total || '·'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
