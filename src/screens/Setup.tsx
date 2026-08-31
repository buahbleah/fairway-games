import { useEffect, useMemo, useState } from 'react'
import { GAMES, gameExists, getGame } from '../games/registry'
import { useRouter } from '../state/router'
import { uid, useStore } from '../state/store'
import { useAccount } from '../state/account'
import { api, type Friend, type League } from '../net/api'
import { AppBar, Avatar, Sheet, Stepper, Switch, useToast } from '../ui/components'
import { StepDots } from '../ui/art'
import { GAME_MARKS, Check, Handicap as HandicapIcon, Plus, Trash } from '../ui/icons'
import { SettingsForm } from './SettingsForm'
import { applyHoleSet, defaultCourse, holeSetLabel, type HoleSet } from '../core/course'
import { courseHandicap, playingHandicaps } from '../core/handicap'
import type { Course, GameId, Player, SettingsValues } from '../core/types'
import { CoursePicker } from './CoursePicker'

const STEP_TITLES = ['Game', 'Players', 'Settings', 'Course', 'Ready']

/** A player picked for the round, remembering whether they are a real account. */
interface Pick extends Player {
  userId?: string | null
}

export function SetupScreen() {
  const { route, go } = useRouter()
  const store = useStore()
  const { account } = useAccount()
  const { showToast, toastNode } = useToast()

  const initialGame = gameExists(route.params.game ?? '') ? (route.params.game as GameId) : 'wolf'
  const initialLeague = route.params.league ?? null

  const [step, setStep] = useState(route.params.game ? 2 : 1)
  const [gameId, setGameId] = useState<GameId>(initialGame)
  const game = getGame(gameId)

  const [players, setPlayers] = useState<Pick[]>([])
  const [settings, setSettings] = useState<SettingsValues>(() => game.defaultSettings())
  const [holeSet, setHoleSet] = useState<HoleSet>('full18')
  const [teamSplit, setTeamSplit] = useState<string[][] | null>(null)
  const [rotation, setRotation] = useState<string[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [friends, setFriends] = useState<Friend[]>([])
  const [leagueMembers, setLeagueMembers] = useState<Friend[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState<string | null>(initialLeague)
  const [playOnline, setPlayOnline] = useState(!!account)

  /**
   * The card the round is played off. Without a real one, stroke indexes are a
   * plausible guess and the shots handicaps give out land on the wrong holes.
   */
  const [pickedCourse, setPickedCourse] = useState<Course | null>(null)
  const [courseWarnings, setCourseWarnings] = useState<string[]>([])
  /** A nine-hole card has no front and back to choose between. */
  const isNineHoleCard = (pickedCourse?.holes.length ?? 18) <= 9
  const course = useMemo(
    () => applyHoleSet(pickedCourse ?? defaultCourse(), isNineHoleCard ? 'full18' : holeSet),
    [pickedCourse, holeSet, isNineHoleCard],
  )
  const playerError = game.validatePlayers(players.length)
  const gamePresets = store.presets.filter((p) => p.gameId === gameId)

  /* Signed in: you are always in the round, and your friends are one tap away. */
  useEffect(() => {
    if (!account) {
      setPlayers(store.roster.slice(0, 4).map((p) => ({ ...p })))
      setPlayOnline(false)
      return
    }
    setPlayers((prev) =>
      prev.length
        ? prev
        : [
            {
              id: `u_${account.id.slice(0, 8)}`,
              userId: account.id,
              name: account.name,
              handicapIndex: account.handicapIndex,
              colorIndex: account.colorIndex,
            },
          ],
    )
    api
      .friends()
      .then((d) => setFriends(d.friends))
      .catch(() => setFriends([]))
    api
      .leagues()
      .then((d) => setLeagues(d.leagues))
      .catch(() => setLeagues([]))
  }, [account, store.roster])

  /* Whoever is in the chosen league can be picked, friend or not. */
  useEffect(() => {
    if (!account || !leagueId) {
      setLeagueMembers([])
      return
    }
    let cancelled = false
    api
      .league(leagueId)
      .then((d) => {
        if (cancelled) return
        setLeagueMembers(d.members.filter((m) => m.id !== account.id))
      })
      .catch(() => !cancelled && setLeagueMembers([]))
    return () => {
      cancelled = true
    }
  }, [account, leagueId])

  const chooseGame = (id: GameId) => {
    setGameId(id)
    setSettings(getGame(id).defaultSettings())
    setTeamSplit(null)
    setRotation(null)
    setStep(2)
  }

  const toggle = (p: Pick) => {
    setPlayers((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]))
  }

  const handicapsOn = !!settings.handicapEnabled && settings.scoring === 'net'
  const setHandicapsOn = (on: boolean) =>
    setSettings((s) => ({ ...s, handicapEnabled: on, scoring: on ? 'net' : 'gross' }))

  const missingHandicaps = handicapsOn ? players.filter((p) => p.handicapIndex == null) : []

  /**
   * What each player will actually receive once the allowance and the
   * off-the-low-player rule are applied — not their raw course handicap, which
   * is a different and more flattering number.
   */
  const shotsGiven = useMemo(
    () =>
      playingHandicaps(players, course, {
        enabled: handicapsOn,
        allowancePct: Number(settings.handicapAllowance ?? 100),
        mode: (settings.handicapMode as 'difference' | 'full') ?? 'difference',
      }),
    [players, course, handicapsOn, settings.handicapAllowance, settings.handicapMode],
  )

  const start = async () => {
    setBusy(true)
    setError(null)
    const gameState: Record<string, any> = {}
    if (teamSplit) gameState.teams = teamSplit
    if (rotation) gameState.rotation = rotation
    if (gameId === 'team_match_play') gameState.teamNames = ['Team Green', 'Team Sand']

    try {
      if (playOnline && account) {
        const { round } = await api.createRound({
          gameId,
          players: players.map((p) => ({
            id: p.id,
            userId: p.userId ?? null,
            name: p.name,
            handicapIndex: p.handicapIndex,
            colorIndex: p.colorIndex,
          })),
          settings,
          course,
          gameState,
          currentHole: course.holes[0]?.number ?? 1,
          leagueId,
        })
        go(`/play?round=${round.id}`, { replace: true })
        return
      }
      const round = store.createRound({
        gameId,
        players: players.map(({ userId: _userId, ...p }) => p),
        settings,
        course,
        gameState,
      })
      go(`/play?round=${round.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start that round.')
      setBusy(false)
    }
  }

  const next = () => setStep((s) => Math.min(5, s + 1))
  // Keep the league attached on the way back out, or Back from the game
  // picker forgets which league the round was being started for.
  const prev = () =>
    step === 1 ? go(leagueId ? '/games?league=' + leagueId : '/games') : setStep((s) => s - 1)

  /* Everyone who could be added, without duplicates. */
  const toPick = (f: Friend): Pick => ({
    id: `u_${f.id.slice(0, 8)}`,
    userId: f.id,
    name: f.name,
    handicapIndex: f.handicapIndex,
    colorIndex: f.colorIndex,
    avatarUrl: f.avatarUrl ?? null,
  })

  const leaguePicks: Pick[] = leagueMembers.map(toPick)
  // A league mate who is also a friend should only be offered once.
  const friendPicks: Pick[] = friends
    .map(toPick)
    .filter((f) => !leaguePicks.some((l) => l.id === f.id))
  const localPicks: Pick[] = store.roster.map((p) => ({ ...p }))
  const full = players.length >= game.meta.maxPlayers

  return (
    <div className="page">
      <AppBar title={STEP_TITLES[step - 1]} onBack={prev} />
      <StepDots total={5} current={step} />

      <div className="stack stack-5" style={{ paddingTop: 'var(--s-3)' }}>
        {/* ------------------------------------------------------- step 1 */}
        {step === 1 && (
          <section className="stack stack-3 stage">
            <h2 className="stage__prompt">Which game today?</h2>
            {GAMES.map((g) => {
              const Mark = GAME_MARKS[g.meta.id]
              return (
                <button
                  key={g.meta.id}
                  className={`playerpick${gameId === g.meta.id ? ' is-selected' : ''}`}
                  onClick={() => chooseGame(g.meta.id)}
                >
                  <span
                    className="resume__mark"
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      background: `var(--game-${g.meta.accent}-soft)`,
                      color: `var(--game-${g.meta.accent})`,
                    }}
                  >
                    <Mark size={22} />
                  </span>
                  <span className="grow">
                    <span style={{ fontWeight: 700, display: 'block' }}>{g.meta.name}</span>
                    <span className="t-sm muted">{g.meta.playersLabel}</span>
                  </span>
                </button>
              )
            })}
          </section>
        )}

        {/* ------------------------------------------------------- step 2 */}
        {step === 2 && (
          <section className="stack stack-4 stage">
            <div>
              <h2 className="stage__prompt">Who is playing?</h2>
              <p className="stage__hint">
                {game.meta.name} · {game.meta.playersLabel} · {players.length} selected
              </p>
            </div>

            {account && leagues.length > 0 && (
              <div className="stack stack-2">
                <h3 className="section-title">League</h3>
                <p className="t-sm muted">
                  Pick a league and its members appear below. The round is added to that league's
                  history.
                </p>
                <div className="row-wrap">
                  <button
                    className={`selectchip${leagueId === null ? ' is-selected' : ''}`}
                    onClick={() => setLeagueId(null)}
                  >
                    No league
                  </button>
                  {leagues.map((l) => (
                    <button
                      key={l.id}
                      className={`selectchip${leagueId === l.id ? ' is-selected' : ''}`}
                      onClick={() => setLeagueId(l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {leaguePicks.length > 0 && (
              <div className="stack stack-2">
                <h3 className="section-title">In this league</h3>
                {leaguePicks.map((f) => (
                  <PlayerRow
                    key={f.id}
                    pick={f}
                    course={course}
                    selected={players.some((x) => x.id === f.id)}
                    disabled={full && !players.some((x) => x.id === f.id)}
                    onToggle={() => toggle(f)}
                  />
                ))}
              </div>
            )}

            {leagueId && leaguePicks.length === 0 && (
              <p className="t-sm muted">
                You are the only member of that league so far. Share its join code, or add guests
                below.
              </p>
            )}

            {friendPicks.length > 0 && (
              <div className="stack stack-2">
                <h3 className="section-title">Friends</h3>
                {friendPicks.map((f) => (
                  <PlayerRow
                    key={f.id}
                    pick={f}
                    course={course}
                    selected={players.some((x) => x.id === f.id)}
                    disabled={full && !players.some((x) => x.id === f.id)}
                    onToggle={() => toggle(f)}
                  />
                ))}
              </div>
            )}

            <div className="stack stack-2">
              {localPicks.length > 0 && <h3 className="section-title">Guests</h3>}
              {localPicks.map((p) => (
                <div key={p.id} className="row" style={{ gap: 'var(--s-2)' }}>
                  <PlayerRow
                    pick={p}
                    course={course}
                    selected={players.some((x) => x.id === p.id)}
                    disabled={full && !players.some((x) => x.id === p.id)}
                    onToggle={() => toggle(p)}
                  />
                  <button
                    className="iconbtn iconbtn--ghost"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => {
                      store.removeRosterPlayer(p.id)
                      setPlayers((prevList) => prevList.filter((x) => x.id !== p.id))
                    }}
                  >
                    <Trash size={20} />
                  </button>
                </div>
              ))}
            </div>

            <button className="btn btn--secondary btn--block" disabled={full} onClick={() => setAddOpen(true)}>
              <Plus size={18} /> Add a guest
            </button>

            {account ? (
              <p className="t-sm muted">
                Anyone with an account scores from their own phone and is told the round has
                started. You keep score for guests.
              </p>
            ) : (
              <button className="btn btn--quiet btn--block" onClick={() => go('/account')}>
                Sign in to play with your league across phones
              </button>
            )}

            {playerError && (
              <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>
                {playerError}
              </p>
            )}
          </section>
        )}

        {/* ------------------------------------------------------- step 3 */}
        {step === 3 && (
          <section className="stack stack-4 stage">
            <div>
              <h2 className="stage__prompt">{game.meta.name} settings</h2>
              <p className="stage__hint">The defaults are the way most groups play.</p>
            </div>

            <div className={`card fairness${handicapsOn ? ' is-on' : ''}`}>
              <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
                <span className="fairness__mark">
                  <HandicapIcon size={22} />
                </span>
                <div className="grow">
                  <div className="field__label">Even it up with handicaps</div>
                  <div className="field__help">
                    {handicapsOn
                      ? `Shots are given on the hardest holes first, off the lowest handicap in the group, so a ${describeGame(gameId)} between a 6 and a 24 is a real contest.`
                      : 'Off — every score counts as played. Turn this on to give shots to the higher handicaps.'}
                  </div>
                </div>
                <Switch checked={handicapsOn} label="Handicap adjusted" onChange={setHandicapsOn} />
              </div>

              {handicapsOn && (
                <div className="stack stack-2" style={{ marginTop: 'var(--s-3)' }}>
                  {players.map((p) => {
                    const shots = shotsGiven[p.id] ?? 0
                    return (
                      <div key={p.id} className="row-between t-sm">
                        <span>{p.name}</span>
                        <span className="num" style={{ fontWeight: 700 }}>
                          {p.handicapIndex == null
                            ? 'no handicap'
                            : shots === 0
                              ? 'scratch — gives shots'
                              : `gets ${shots} shot${shots === 1 ? '' : 's'}`}
                        </span>
                      </div>
                    )
                  })}
                  {missingHandicaps.length > 0 && (
                    <p className="t-sm" style={{ color: 'var(--bad)' }}>
                      {missingHandicaps.map((p) => p.name).join(', ')}{' '}
                      {missingHandicaps.length === 1 ? 'has' : 'have'} no handicap yet, so{' '}
                      {missingHandicaps.length === 1 ? 'they play' : 'they play'} off scratch. Each
                      player sets their own in Settings.
                    </p>
                  )}
                </div>
              )}
            </div>

            {gamePresets.length > 0 && (
              <div className="stack stack-2">
                <h3 className="section-title">Saved setups</h3>
                <div className="row-wrap">
                  {gamePresets.map((p) => (
                    <button
                      key={p.id}
                      className="selectchip"
                      onClick={() => setSettings({ ...game.defaultSettings(), ...p.settings })}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <SettingsForm game={game} values={settings} onChange={setSettings} />

            <button className="btn btn--quiet" onClick={() => setSavePresetOpen(true)}>
              Save these settings as a preset
            </button>
          </section>
        )}

        {/* ------------------------------------------------------- step 4 */}
        {step === 4 && (
          <section className="stack stack-4 stage">
            <div>
              <h2 className="stage__prompt">Where are you playing?</h2>
              <p className="stage__hint">
                {handicapsOn
                  ? 'Find the course and shots land on its real hardest holes.'
                  : 'Optional — but it makes handicaps land on the right holes.'}
              </p>
            </div>

            <CoursePicker
              value={pickedCourse}
              onClear={() => {
                setPickedCourse(null)
                setCourseWarnings([])
              }}
              onChange={(next, warnings) => {
                setPickedCourse(next)
                setCourseWarnings(warnings)
                if (next.holes.length <= 9) setHoleSet('full18')
              }}
            />

            {courseWarnings.map((w) => (
              <p key={w} className="field__help" style={{ color: 'var(--warn, var(--accent))' }}>
                {w}
              </p>
            ))}

            {!isNineHoleCard && (
              <>
                <div>
                  <h2 className="stage__prompt">Which holes?</h2>
                  <p className="stage__hint">Nine or eighteen.</p>
                </div>

                <div className="stack stack-2">
                  {(['full18', 'front9', 'back9'] as HoleSet[]).map((set) => (
                    <button
                      key={set}
                      className={`playerpick${holeSet === set ? ' is-selected' : ''}`}
                      onClick={() => setHoleSet(set)}
                    >
                      <span className="playerpick__check" aria-hidden>
                        <Check size={16} />
                      </span>
                      <span className="grow" style={{ fontWeight: 700 }}>
                        {holeSetLabel(set)}
                      </span>
                      <span className="t-sm muted">{set === 'full18' ? '18 holes' : '9 holes'}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {(gameId === 'vegas' || gameId === 'team_match_play' || (gameId === 'nassau' && players.length === 4)) &&
              players.length === 4 && (
                <TeamPicker players={players} value={teamSplit} onChange={setTeamSplit} />
              )}

            {gameId === 'wolf' && settings.rotation === 'custom' && (
              <RotationPicker players={players} value={rotation} onChange={setRotation} />
            )}
          </section>
        )}

        {/* ------------------------------------------------------- step 5 */}
        {step === 5 && (
          <section className="stack stack-4 stage">
            <h2 className="stage__prompt">Ready to play</h2>

            {account && (
              <div className={`card fairness${playOnline ? ' is-on' : ''}`}>
                <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="field__label">Score this round together</div>
                    <div className="field__help">
                      {playOnline
                        ? 'Everyone with an account sees the card fill in on their own phone, live. It still works if someone loses signal — their scores send when they get it back.'
                        : 'Off — this round stays on this phone only.'}
                    </div>
                  </div>
                  <Switch checked={playOnline} label="Score together" onChange={setPlayOnline} />
                </div>

                {playOnline && leagueId && (
                  <div className="row-between" style={{ marginTop: 'var(--s-4)' }}>
                    <span className="label">League</span>
                    <span style={{ fontWeight: 700 }}>
                      {leagues.find((l) => l.id === leagueId)?.name ?? 'Selected'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="card stack stack-3">
              <div className="row-between">
                <span className="label">Game</span>
                <span style={{ fontWeight: 700 }}>{game.meta.name}</span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Players</span>
                <span style={{ fontWeight: 700, textAlign: 'right' }}>
                  {players.map((p) => p.name).join(', ')}
                </span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Course</span>
                <span style={{ fontWeight: 700, textAlign: 'right' }}>
                  {pickedCourse ? (
                    <>
                      {pickedCourse.name}
                      {pickedCourse.teeName && (
                        <span className="t-sm muted" style={{ display: 'block', fontWeight: 400 }}>
                          {pickedCourse.teeName} tees
                        </span>
                      )}
                    </>
                  ) : (
                    'Standard card'
                  )}
                </span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Holes</span>
                <span style={{ fontWeight: 700 }}>
                  {isNineHoleCard ? '9 Holes' : holeSetLabel(holeSet)}
                </span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Scoring</span>
                <span style={{ fontWeight: 700 }}>
                  {handicapsOn ? `Net · handicaps ${settings.handicapAllowance ?? 100}%` : 'Gross'}
                </span>
              </div>
            </div>

            {error && (
              <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>
                {error}
              </p>
            )}
          </section>
        )}
      </div>

      <div className="actionbar">
        {step < 5 ? (
          <button className="btn btn--primary btn--xl" disabled={step === 2 && !!playerError} onClick={next}>
            Continue
          </button>
        ) : (
          <button className="btn btn--primary btn--xl" disabled={busy} onClick={start}>
            {busy ? 'Starting…' : 'Start Round'}
          </button>
        )}
      </div>

      <AddPlayerSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        colorIndex={store.roster.length + players.length}
        onAdd={(p) => {
          store.saveRosterPlayer(p)
          setPlayers((prevList) => (prevList.length < game.meta.maxPlayers ? [...prevList, p] : prevList))
          setAddOpen(false)
        }}
      />

      <Sheet
        open={savePresetOpen}
        onClose={() => setSavePresetOpen(false)}
        title="Save preset"
        footer={
          <button
            className="btn btn--primary btn--block"
            disabled={!presetName.trim()}
            onClick={() => {
              store.savePreset({ gameId, name: presetName.trim(), settings })
              setPresetName('')
              setSavePresetOpen(false)
              showToast({ message: 'Preset saved' })
            }}
          >
            Save
          </button>
        }
      >
        <p className="t-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
          Give this setup a name — "Saturday Wolf", "Boys Vegas" — and it is one tap next time.
        </p>
        <input
          className="input"
          value={presetName}
          placeholder="Saturday Wolf"
          onChange={(e) => setPresetName(e.target.value)}
        />
      </Sheet>

      {toastNode}
    </div>
  )
}

/* --------------------------------------------------------------- helpers */

function describeGame(id: GameId): string {
  switch (id) {
    case 'wolf':
      return 'Wolf hole'
    case 'skins':
      return 'skin'
    case 'vegas':
      return 'Vegas hole'
    case 'nassau':
      return 'Nassau'
    case 'team_match_play':
      return 'match'
    default:
      return 'round'
  }
}

function PlayerRow({
  pick,
  course,
  selected,
  disabled,
  onToggle,
}: {
  pick: Pick
  course: ReturnType<typeof defaultCourse>
  selected: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      className={`playerpick grow${selected ? ' is-selected' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      disabled={disabled}
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      <span className="playerpick__check" aria-hidden>
        <Check size={16} />
      </span>
      <Avatar player={pick} size="sm" />
      <span className="grow">
        <span style={{ fontWeight: 700, display: 'block' }}>{pick.name}</span>
        <span className="t-sm muted">
          {pick.handicapIndex != null
            ? `HCP ${pick.handicapIndex.toFixed(1)} · plays off ${courseHandicap(pick, course)}`
            : pick.userId
              ? 'No handicap set'
              : 'Guest'}
        </span>
      </span>
    </button>
  )
}

function AddPlayerSheet({
  open,
  onClose,
  onAdd,
  colorIndex,
}: {
  open: boolean
  onClose: () => void
  onAdd: (p: Player) => void
  colorIndex: number
}) {
  const [name, setName] = useState('')
  const [hcp, setHcp] = useState<number | null>(null)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a guest"
      footer={
        <button
          className="btn btn--primary btn--block"
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ id: uid('player'), name: name.trim(), handicapIndex: hcp, colorIndex: colorIndex % 6 })
            setName('')
            setHcp(null)
          }}
        >
          Add
        </button>
      }
    >
      <div className="stack stack-4">
        <div className="field">
          <label className="field__label" htmlFor="player-name">
            Name
          </label>
          <input
            id="player-name"
            className="input"
            value={name}
            placeholder="Marc"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="row-between">
            <div className="grow">
              <div className="field__label">Handicap index</div>
              <div className="field__help">Only needed if you are playing off handicaps.</div>
            </div>
            <Stepper value={hcp ?? 0} min={-10} max={54} step={0.5} label="Handicap index" onChange={setHcp} />
          </div>
        </div>
      </div>
    </Sheet>
  )
}

function TeamPicker({
  players,
  value,
  onChange,
}: {
  players: Player[]
  value: string[][] | null
  onChange: (v: string[][]) => void
}) {
  const ids = players.map((p) => p.id)
  const teams = value ?? [ids.slice(0, 2), ids.slice(2, 4)]
  const move = (id: string) => {
    const inA = teams[0].includes(id)
    const a = inA ? teams[0].filter((x) => x !== id) : [...teams[0], id]
    const b = inA ? [...teams[1], id] : teams[1].filter((x) => x !== id)
    onChange([a, b])
  }
  const random = () => {
    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    onChange([shuffled.slice(0, 2), shuffled.slice(2, 4)])
  }
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? ''

  return (
    <div className="stack stack-3">
      <h3 className="section-title">Teams</h3>
      <div className="teamhead">
        <div className="teamside teamside--green">
          <div className="teamside__name">Team Green</div>
          <div className="teamside__players">{teams[0].map(name).join(' + ') || '—'}</div>
        </div>
        <div className="matchstate__sub">vs</div>
        <div className="teamside teamside--sand">
          <div className="teamside__name">Team Sand</div>
          <div className="teamside__players">{teams[1].map(name).join(' + ') || '—'}</div>
        </div>
      </div>
      <div className="stack stack-2">
        {players.map((p) => (
          <button key={p.id} className="playerpick" onClick={() => move(p.id)}>
            <Avatar player={p} size="sm" />
            <span className="grow" style={{ fontWeight: 700 }}>
              {p.name}
            </span>
            <span className={`chip ${teams[0].includes(p.id) ? 'chip--good' : 'chip--accent'}`}>
              {teams[0].includes(p.id) ? 'Green' : 'Sand'}
            </span>
          </button>
        ))}
      </div>
      <button className="btn btn--secondary btn--block" onClick={random}>
        Random teams
      </button>
    </div>
  )
}

function RotationPicker({
  players,
  value,
  onChange,
}: {
  players: Player[]
  value: string[] | null
  onChange: (v: string[]) => void
}) {
  const order = value ?? players.map((p) => p.id)
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? ''
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="stack stack-3">
      <h3 className="section-title">Wolf rotation</h3>
      <p className="t-sm muted">The order the Wolf passes around the group.</p>
      {order.map((id, i) => (
        <div key={id} className="playerpick">
          <span className="lb__rank num">{i + 1}</span>
          <span className="grow" style={{ fontWeight: 700 }}>
            {name(id)}
          </span>
          <button className="iconbtn" aria-label="Move up" onClick={() => swap(i, i - 1)}>
            ↑
          </button>
          <button className="iconbtn" aria-label="Move down" onClick={() => swap(i, i + 1)}>
            ↓
          </button>
        </div>
      ))}
    </div>
  )
}
