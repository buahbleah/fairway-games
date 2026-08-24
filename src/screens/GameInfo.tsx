import { useMemo, useState } from 'react'
import { GAMES, gameExists, getGame } from '../games/registry'
import { useRouter } from '../state/router'
import { AppBar, Rating, Sheet } from '../ui/components'
import { GAME_MARKS } from '../ui/icons'
import { SettingsForm } from './SettingsForm'
import type { SettingsValues } from '../core/types'
import { useStore } from '../state/store'

/**
 * The rules screen. Written for a golfer who has never heard of the format:
 * what happens on a hole, what the points are, a worked example using the
 * settings that are actually switched on, and the common variations with the
 * active ones clearly marked.
 */
export function GameInfoScreen({ gameId }: { gameId: string }) {
  const { go } = useRouter()
  const { presets } = useStore()
  const valid = gameExists(gameId)
  const game = valid ? getGame(gameId) : GAMES[0]
  const [settings, setSettings] = useState<SettingsValues>(() => game.defaultSettings())
  const [showSettings, setShowSettings] = useState(false)
  const doc = useMemo(() => game.explain(settings), [game, settings])
  const Mark = GAME_MARKS[game.meta.id]
  const gamePresets = presets.filter((p) => p.gameId === game.meta.id)

  return (
    <div className="page">
      <AppBar title={game.meta.name} />

      <div className="stack stack-5" style={{ paddingBottom: 'var(--s-6)' }}>
        <header
          className="rules-hero"
          style={{ '--tile': `var(--game-${game.meta.accent})` } as React.CSSProperties}
        >
          <span className="rules-hero__mark">
            <Mark size={30} />
          </span>
          <h1 className="rules-hero__title">{game.meta.name}</h1>
          <p style={{ color: 'rgba(255,255,255,.8)' }}>{game.meta.tagline}</p>
          <div className="rules-hero__stats">
            <div className="rules-hero__stat">
              <div className="label">Best for</div>
              <div>{game.meta.bestFor}</div>
            </div>
            <div className="rules-hero__stat">
              <div className="label">Complexity</div>
              <div>
                <Rating value={game.meta.complexity} label="Complexity" />
              </div>
            </div>
            <div className="rules-hero__stat">
              <div className="label">Strategy</div>
              <div>
                <Rating value={game.meta.strategy} label="Strategy" />
              </div>
            </div>
            <div className="rules-hero__stat">
              <div className="label">Point swings</div>
              <div>{game.meta.swing}</div>
            </div>
          </div>
        </header>

        <p className="t-body">{doc.summary}</p>

        {doc.sections.map((section) => (
          <section key={section.title} className="rules-section">
            <h3>{section.title}</h3>
            <ul>
              {section.body.map((line, i) => (
                <li key={i}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {doc.example && (
          <section className="stack stack-3">
            <h3 className="section-title">Example</h3>
            <div className="example">
              <div className="example__head">{doc.example.title}</div>
              {doc.example.rows.map((row, i) => (
                <div key={i} className={`example__row${row.emphasis ? ' is-emph' : ''}`}>
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
              <div className="example__result">{doc.example.result}</div>
            </div>
          </section>
        )}

        {doc.definitions && doc.definitions.length > 0 && (
          <section className="stack stack-2">
            <h3 className="section-title">Words you will hear</h3>
            {doc.definitions.map((d) => (
              <div key={d.term} className="card card--tight card--flat">
                <div style={{ fontWeight: 700 }}>{d.term}</div>
                <div className="t-sm muted">{d.text}</div>
              </div>
            ))}
          </section>
        )}

        <section className="stack stack-2">
          <h3 className="section-title">Common variations</h3>
          <p className="t-sm muted">
            Every group plays these games a little differently. The ones marked <strong>On</strong>{' '}
            are what this round will use — change them in Game Settings.
          </p>
          {doc.variations.map((v) => (
            <div key={v.name} className={`variation${v.active ? ' is-active' : ''}`}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{v.name}</div>
                <div className="t-sm muted">{v.text}</div>
              </div>
              {v.active && <span className="variation__flag">On</span>}
            </div>
          ))}
        </section>

        {gamePresets.length > 0 && (
          <section className="stack stack-2">
            <h3 className="section-title">Your saved setups</h3>
            {gamePresets.map((p) => (
              <button
                key={p.id}
                className="card card--tight card--interactive"
                onClick={() => setSettings({ ...game.defaultSettings(), ...p.settings })}
              >
                <div className="row-between">
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  <span className="chip">Load</span>
                </div>
              </button>
            ))}
          </section>
        )}
      </div>

      <div className="actionbar">
        <button className="btn btn--secondary" onClick={() => setShowSettings(true)}>
          Settings
        </button>
        <button className="btn btn--primary" onClick={() => go(`/setup?game=${game.meta.id}`)}>
          Start {game.meta.name}
        </button>
      </div>

      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title={`${game.meta.name} settings`}>
        <p className="t-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
          Preview how the rules read with different settings. You will confirm these again when you
          set the round up.
        </p>
        <SettingsForm game={game} values={settings} onChange={setSettings} />
      </Sheet>
    </div>
  )
}
