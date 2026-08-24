import { useMemo, useState } from 'react'
import { GAMES, gameExists, getGame } from '../games/registry'
import { useRouter } from '../state/router'
import { uid, useStore } from '../state/store'
import { AppBar, Avatar, Sheet, Stepper } from '../ui/components'
import { StepDots } from '../ui/art'
import { GAME_MARKS, Check, Plus, Trash } from '../ui/icons'
import { SettingsForm } from './SettingsForm'
import { applyHoleSet, defaultCourse, holeSetLabel, type HoleSet } from '../core/course'
import { courseHandicap } from '../core/handicap'
import type { GameId, Player, SettingsValues } from '../core/types'

const STEP_TITLES = ['Game', 'Players', 'Settings', 'Course', 'Ready']

export function SetupScreen() {
  const { route, go } = useRouter()
  const store = useStore()
  const initialGame = gameExists(route.params.game ?? '') ? (route.params.game as GameId) : 'wolf'

  const [step, setStep] = useState(route.params.game ? 2 : 1)
  const [gameId, setGameId] = useState<GameId>(initialGame)
  const game = getGame(gameId)

  const [players, setPlayers] = useState<Player[]>(() => store.roster.slice(0, 4))
  const [settings, setSettings] = useState<SettingsValues>(() => game.defaultSettings())
  const [holeSet, setHoleSet] = useState<HoleSet>('full18')
  const [teamSplit, setTeamSplit] = useState<string[][] | null>(null)
  const [rotation, setRotation] = useState<string[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [presetName, setPresetName] = useState('')

  const course = useMemo(() => applyHoleSet(defaultCourse(), holeSet), [holeSet])
  const playerError = game.validatePlayers(players.length)
  const gamePresets = store.presets.filter((p) => p.gameId === gameId)

  const chooseGame = (id: GameId) => {
    setGameId(id)
    setSettings(getGame(id).defaultSettings())
    setTeamSplit(null)
    setRotation(null)
    setStep(2)
  }

  const addPlayer = (p: Player) => {
    setPlayers((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]))
  }

  const start = () => {
    const gameState: Record<string, any> = {}
    if (teamSplit) gameState.teams = teamSplit
    if (rotation) gameState.rotation = rotation
    if (gameId === 'team_match_play') gameState.teamNames = ['Team Green', 'Team Sand']
    const round = store.createRound({ gameId, players, settings, course, gameState })
    go(`/play?round=${round.id}`, { replace: true })
  }

  const next = () => setStep((s) => Math.min(5, s + 1))
  const prev = () => (step === 1 ? go('/games') : setStep((s) => s - 1))

  return (
    <div className="page">
      <AppBar title={`${STEP_TITLES[step - 1]}`} onBack={prev} />
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
          <section className="stack stack-3 stage">
            <div>
              <h2 className="stage__prompt">Who is playing?</h2>
              <p className="stage__hint">{game.meta.name} · {game.meta.playersLabel}</p>
            </div>

            {store.roster.length === 0 && (
              <p className="t-sm muted">Add the players in your group. They are remembered for next time.</p>
            )}

            <div className="stack stack-2">
              {store.roster.map((p) => {
                const selected = players.some((x) => x.id === p.id)
                return (
                  <div key={p.id} className="row" style={{ gap: 'var(--s-2)' }}>
                    <button
                      className={`playerpick grow${selected ? ' is-selected' : ''}`}
                      onClick={() => addPlayer(p)}
                      aria-pressed={selected}
                    >
                      <span className="playerpick__check" aria-hidden>
                        <Check size={16} />
                      </span>
                      <Avatar player={p} size="sm" />
                      <span className="grow">
                        <span style={{ fontWeight: 700, display: 'block' }}>{p.name}</span>
                        {p.handicapIndex != null && (
                          <span className="t-sm muted">
                            HCP {p.handicapIndex.toFixed(1)} · plays off {courseHandicap(p, course)}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      className="iconbtn iconbtn--ghost"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => {
                        store.removeRosterPlayer(p.id)
                        setPlayers((prev) => prev.filter((x) => x.id !== p.id))
                      }}
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                )
              })}
            </div>

            <button className="btn btn--secondary btn--block" onClick={() => setAddOpen(true)}>
              <Plus size={18} /> Add player
            </button>

            {playerError && <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>{playerError}</p>}
          </section>
        )}

        {/* ------------------------------------------------------- step 3 */}
        {step === 3 && (
          <section className="stack stack-4 stage">
            <div>
              <h2 className="stage__prompt">{game.meta.name} settings</h2>
              <p className="stage__hint">The defaults are the way most groups play. Change what you like.</p>
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
              <h2 className="stage__prompt">Which holes?</h2>
              <p className="stage__hint">Par and stroke index can be adjusted below if your card differs.</p>
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
            <div className="card stack stack-3">
              <div className="row-between">
                <span className="label">Game</span>
                <span style={{ fontWeight: 700 }}>{game.meta.name}</span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Players</span>
                <span style={{ fontWeight: 700 }}>{players.map((p) => p.name).join(', ')}</span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Holes</span>
                <span style={{ fontWeight: 700 }}>{holeSetLabel(holeSet)}</span>
              </div>
              <hr className="divider" />
              <div className="row-between">
                <span className="label">Scoring</span>
                <span style={{ fontWeight: 700 }}>
                  {settings.scoring === 'net' ? 'Net' : 'Gross'}
                  {settings.handicapEnabled ? ` · handicaps ${settings.handicapAllowance ?? 100}%` : ''}
                </span>
              </div>
            </div>
            <p className="t-sm muted">
              Everything is saved on this phone as you play, so you can lock it, lose signal, and pick
              the round straight back up.
            </p>
          </section>
        )}
      </div>

      <div className="actionbar">
        {step < 5 ? (
          <button
            className="btn btn--primary btn--xl"
            disabled={step === 2 && !!playerError}
            onClick={next}
          >
            Continue
          </button>
        ) : (
          <button className="btn btn--primary btn--xl" onClick={start}>
            Start Round
          </button>
        )}
      </div>

      <AddPlayerSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        colorIndex={store.roster.length}
        onAdd={(p) => {
          store.saveRosterPlayer(p)
          setPlayers((prev) => (prev.length < game.meta.maxPlayers ? [...prev, p] : prev))
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
            }}
          >
            Save
          </button>
        }
      >
        <p className="t-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
          Give this setup a name — "Saturday Wolf", "Boys Vegas" — and it will be one tap next time.
        </p>
        <input
          className="input"
          value={presetName}
          placeholder="Saturday Wolf"
          onChange={(e) => setPresetName(e.target.value)}
        />
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------- sub-screens */

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
      title="Add player"
      footer={
        <button
          className="btn btn--primary btn--block"
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ id: uid('player'), name: name.trim(), handicapIndex: hcp, colorIndex })
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
              <div className="field__help">Only needed if you play net. Leave at zero otherwise.</div>
            </div>
            <Stepper
              value={hcp ?? 0}
              min={-5}
              max={54}
              step={0.5}
              label="Handicap index"
              onChange={(v) => setHcp(v)}
            />
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
