import { useState } from 'react'
import type { HudProps } from '../hudRegistry'
import { Collapse, Sheet } from '../../ui/components'
import type { MatchLine, Matchup, PressRecord, Segment, Side } from './index'

export function NassauHud({ round, computed, patchGameState }: HudProps) {
  const lines = (computed.extra?.lines ?? []) as MatchLine[]
  const matchups = (computed.extra?.matchups ?? []) as Matchup[]
  const [pressOpen, setPressOpen] = useState(false)
  if (!matchups.length) return null

  const primary = matchups[0]
  const base = lines.filter((l) => l.matchupId === primary.id && !l.isPress)
  const presses = lines.filter((l) => l.isPress)
  const canPress = !!round.settings.pressesEnabled

  const sideLabel = (l: MatchLine) => {
    const m = matchups.find((mm) => mm.id === l.matchupId)!
    if (l.diff === 0) return l.holesPlayed === 0 ? '—' : 'AS'
    return `${l.diff > 0 ? m.labelA : m.labelB} ${l.status}`
  }

  const segment: Segment = round.currentHole > 9 ? 'back' : 'front'

  const addPress = (matchupId: string, by: Side) => {
    const existing = (round.gameState.presses ?? []) as PressRecord[]
    const press: PressRecord = {
      id: `press_${matchupId}_${round.currentHole}_${by}`,
      matchupId,
      segment,
      startHole: round.currentHole,
      by,
      auto: false,
      parentId: `${matchupId}:${segment}`,
    }
    if (existing.some((p) => p.id === press.id)) return
    patchGameState({ presses: [...existing, press] }, 'Press')
    setPressOpen(false)
  }

  return (
    <div className="stack stack-3">
      <div className="nassaubar">
        {base.map((l) => (
          <div key={l.id} className={`nassaubar__seg${l.diff > 0 ? ' is-a' : l.diff < 0 ? ' is-b' : ''}`}>
            <span className="label">{l.label}</span>
            <span className="nassaubar__status">{l.holesPlayed === 0 ? '—' : l.status}</span>
          </div>
        ))}
      </div>

      {matchups.length > 1 && (
        <Collapse title={`All matches (${matchups.length})`}>
          <div className="stack stack-2">
            {matchups.map((m) => {
              const own = lines.filter((l) => l.matchupId === m.id && !l.isPress)
              return (
                <div key={m.id} className="row-between t-sm">
                  <span style={{ fontWeight: 700 }}>
                    {m.labelA} v {m.labelB}
                  </span>
                  <span className="muted">
                    {own.map((l) => `${l.label.split(' ')[0]} ${l.status}`).join(' · ')}
                  </span>
                </div>
              )
            })}
          </div>
        </Collapse>
      )}

      {presses.length > 0 && (
        <Collapse title={`Presses (${presses.length})`}>
          <div className="stack stack-2">
            {presses.map((p) => (
              <div key={p.id} className="row-between t-sm">
                <span>{p.label}</span>
                <span style={{ fontWeight: 700 }}>{sideLabel(p)}</span>
              </div>
            ))}
          </div>
        </Collapse>
      )}

      {canPress && (
        <button className="btn btn--secondary btn--block" onClick={() => setPressOpen(true)}>
          Press
        </button>
      )}

      <Sheet open={pressOpen} onClose={() => setPressOpen(false)} title="Start a press">
        <p className="t-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
          A press opens a brand new bet running from hole {round.currentHole} to the end of the{' '}
          {segment === 'front' ? 'front' : 'back'} nine. It does not change the bets already running.
        </p>
        <div className="stack stack-2">
          {matchups.map((m) => (
            <div key={m.id} className="stack stack-2">
              {matchups.length > 1 && (
                <div className="label">
                  {m.labelA} v {m.labelB}
                </div>
              )}
              <button className="btn btn--secondary btn--block" onClick={() => addPress(m.id, 'A')}>
                {m.labelA} press
              </button>
              <button className="btn btn--secondary btn--block" onClick={() => addPress(m.id, 'B')}>
                {m.labelB} press
              </button>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
