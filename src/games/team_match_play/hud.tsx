import { useState } from 'react'
import type { HudProps } from '../hudRegistry'
import { namesOf } from '../../core/scoring'
import type { MatchState, Side } from './index'
import { Sheet } from '../../ui/components'

export function TeamMatchHud({ round, computed, patchEntry, patchGameState }: HudProps) {
  const state = computed.extra?.match as MatchState | undefined
  const teams = computed.teams ?? []
  const [concedeOpen, setConcedeOpen] = useState(false)
  if (!state || teams.length < 2) return null

  const leader = state.diff > 0 ? 0 : state.diff < 0 ? 1 : null
  const concessions = !!round.settings.concessions
  const concedeHole = (by: Side) => {
    patchEntry({ game: { conceded: by } }, `Hole ${round.currentHole} conceded`)
    setConcedeOpen(false)
  }
  const concedeMatch = (by: Side) => {
    patchGameState({ matchConcededBy: by }, 'Match conceded')
    setConcedeOpen(false)
  }

  const concededBy = (round.gameState.matchConcededBy ?? null) as Side | null
  const conceededHoleBy = (round.entries.find((e) => e.hole === round.currentHole)?.game
    ?.conceded ?? null) as Side | null

  return (
    <div className="stack stack-3">
      <div className="teamhead">
        <div className={`teamside teamside--green${leader === 0 ? ' is-leading' : ''}`}>
          <div className="teamside__name">{teams[0].name}</div>
          <div className="teamside__players">{namesOf(round.players, teams[0].playerIds)}</div>
        </div>
        <div>
          <div className="matchstate">{state.status}</div>
          <div className="matchstate__sub">
            {state.holesPlayed === 0 ? 'to play' : `thru ${state.holesPlayed}`}
          </div>
        </div>
        <div className={`teamside teamside--sand${leader === 1 ? ' is-leading' : ''}`}>
          <div className="teamside__name">{teams[1].name}</div>
          <div className="teamside__players">{namesOf(round.players, teams[1].playerIds)}</div>
        </div>
      </div>

      {state.dormie && !state.decided && (
        <div className="chip chip--accent" style={{ justifyContent: 'center', width: '100%' }}>
          Dormie — {state.diff > 0 ? teams[0].name : teams[1].name} cannot lose from here
        </div>
      )}
      {state.suddenDeath && (
        <div className="chip chip--accent" style={{ justifyContent: 'center', width: '100%' }}>
          All square after 18 — sudden death
        </div>
      )}
      {state.decided && state.winner && (
        <div className="chip chip--good" style={{ justifyContent: 'center', width: '100%' }}>
          Match over — {state.winner === 'A' ? teams[0].name : teams[1].name} win {state.status}
        </div>
      )}

      {concessions && !state.decided && (
        <button className="btn btn--quiet btn--block" onClick={() => setConcedeOpen(true)}>
          Concede
        </button>
      )}

      {/* Conceding is one tap and ends the match, so it needs a way back. A
          concession the players meant stays put; a mis-tap does not. */}
      {concededBy && (
        <div className="decisionbar">
          <span className="grow">
            <span className="decisionbar__label">Match conceded by</span>
            <span className="decisionbar__value">
              {concededBy === 'A' ? teams[0].name : teams[1].name}
            </span>
          </span>
          <button
            className="btn btn--quiet"
            onClick={() => patchGameState({ matchConcededBy: null }, 'Concession withdrawn')}
          >
            Undo
          </button>
        </div>
      )}

      {conceededHoleBy && (
        <div className="decisionbar">
          <span className="grow">
            <span className="decisionbar__label">Hole {round.currentHole} conceded by</span>
            <span className="decisionbar__value">
              {conceededHoleBy === 'A' ? teams[0].name : teams[1].name}
            </span>
          </span>
          <button
            className="btn btn--quiet"
            onClick={() => patchEntry({ game: { conceded: null } }, 'Hole concession withdrawn')}
          >
            Undo
          </button>
        </div>
      )}

      <Sheet open={concedeOpen} onClose={() => setConcedeOpen(false)} title="Concede">
        <p className="t-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
          Giving a hole or a match to the opposition is ordinary golf etiquette. Pick who is
          conceding.
        </p>
        <div className="stack stack-2">
          <div className="label">This hole</div>
          <button className="btn btn--secondary btn--block" onClick={() => concedeHole('A')}>
            {teams[0].name} concede hole {round.currentHole}
          </button>
          <button className="btn btn--secondary btn--block" onClick={() => concedeHole('B')}>
            {teams[1].name} concede hole {round.currentHole}
          </button>
          <div className="label" style={{ marginTop: 'var(--s-3)' }}>
            The whole match
          </div>
          <button className="btn btn--danger btn--block" onClick={() => concedeMatch('A')}>
            {teams[0].name} concede the match
          </button>
          <button className="btn btn--danger btn--block" onClick={() => concedeMatch('B')}>
            {teams[1].name} concede the match
          </button>
        </div>
      </Sheet>
    </div>
  )
}
