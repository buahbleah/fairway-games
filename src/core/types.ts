/**
 * Fairway Games — core domain types.
 *
 * Design rule: a round is stored as (setup + a list of hole entries). Everything
 * else — standings, match status, results — is DERIVED by a pure fold over those
 * entries. That single decision gives us undo, hole editing, resume and history
 * for free: change the entries, recompute, done. No game keeps hidden state.
 */

export type PlayerId = string

export interface Player {
  id: PlayerId
  name: string
  /** WHS Handicap Index, e.g. 11.4. Null when the player plays off scratch/unknown. */
  handicapIndex: number | null
  /** Avatar accent, index into design/avatarColors. */
  colorIndex: number
  /** Optional profile picture, stored as a small data URL. */
  avatarUrl?: string | null
}

export interface Hole {
  number: number
  par: number
  /** Stroke index / handicap ranking 1..18 — where shots are given. */
  strokeIndex: number
  yards?: number
}

export interface Course {
  id: string
  name: string
  holes: Hole[]
  /** Course & slope rating, used to convert Handicap Index -> Course Handicap. */
  courseRating?: number
  slopeRating?: number
}

/* ------------------------------------------------------------------ settings */

export type SettingDef =
  | NumericSetting
  | ToggleSetting
  | ChoiceSetting
  | CurrencySetting
  | HoleValuesSetting
  | DotBuilderSetting

interface SettingBase {
  key: string
  label: string
  /** One line shown under the control. Always written for a golfer, not a dev. */
  help?: string
  /** Grouping header in the settings sheet. */
  group?: string
  /** Only show when this predicate over the current settings passes. */
  visibleWhen?: (s: SettingsValues) => boolean
  /** Marks a setting as advanced — hidden behind "More options". */
  advanced?: boolean
}

export interface NumericSetting extends SettingBase {
  type: 'number'
  default: number
  min: number
  max: number
  step?: number
  /** Optional quick-pick chips shown above the stepper. */
  presets?: number[]
  suffix?: string
}

export interface ToggleSetting extends SettingBase {
  type: 'toggle'
  default: boolean
}

export interface ChoiceSetting extends SettingBase {
  type: 'choice'
  default: string
  options: { value: string; label: string; help?: string }[]
}

export interface CurrencySetting extends SettingBase {
  type: 'currency'
  default: number
  min: number
  max: number
  step?: number
}

export interface HoleValuesSetting extends SettingBase {
  type: 'holeValues'
  /** Map of hole number -> value. Absent hole = the game's default value. */
  default: Record<string, number>
}

export interface DotBuilderSetting extends SettingBase {
  type: 'dotBuilder'
  default: string
}

export type SettingsValues = Record<string, any>

/* ------------------------------------------------------------- round + entries */

export interface HoleEntry {
  hole: number
  /** Gross strokes per player. null = not entered (picked up / conceded). */
  scores: Record<PlayerId, number | null>
  /** Free-form, game-owned payload (wolf pick, dots earned, team split, ...). */
  game?: Record<string, any>
  /** True once the golfer confirmed the hole; drives "current hole". */
  complete: boolean
}

export type RoundStatus = 'active' | 'finished'

export interface Round {
  id: string
  gameId: GameId
  createdAt: number
  updatedAt: number
  status: RoundStatus
  title?: string
  players: Player[]
  course: Course
  settings: SettingsValues
  entries: HoleEntry[]
  /** 1-based hole the golfer is currently on. */
  currentHole: number
  /** Round-level, game-owned data (nassau presses, team assignments, ...). */
  gameState: Record<string, any>
  /** Set for a shared round that counts towards a league. Drives "up" navigation. */
  leagueId?: string | null
}

/* --------------------------------------------------------------- computed view */

export interface HoleOutcome {
  hole: number
  /** Points awarded this hole, by player. Match-play games leave this empty. */
  points: Record<PlayerId, number>
  /** One line the app shows in history: "Marc + Phil won the hole · +2 each". */
  headline: string
  /** Optional extra lines (carryovers, presses started, dots earned). */
  detail?: string[]
  /** Set when the hole could not be scored yet (missing scores). */
  pending?: boolean
}

export interface StandingRow {
  playerId: PlayerId
  /** Primary number the leaderboard sorts on. */
  value: number
  /** How to render `value`: "+7", "3 UP", "7 skins". */
  display: string
  /** Secondary line, e.g. money equivalent or gross score. */
  sub?: string
  rank: number
  /** Position change since the previous completed hole: +1 up, -1 down, 0 same. */
  movement?: number
}

export interface TeamView {
  id: string
  name: string
  playerIds: PlayerId[]
  colorKey: 'green' | 'sand'
}

export interface StatusChip {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'bad' | 'accent'
}

export interface ComputedRound {
  outcomes: HoleOutcome[]
  standings: StandingRow[]
  /** Rendered by the game-specific status strip above the hole. */
  status: StatusChip[]
  /** Present for match-play style games. */
  teams?: TeamView[]
  /** True when the game itself ended (match closed out) before hole 18. */
  closedOut?: boolean
  /** Extra numbers a game wants to expose to its own screens. */
  extra?: Record<string, any>
}

export interface FinalResult {
  headline: string
  subhead?: string
  winners: PlayerId[]
  standings: StandingRow[]
  /** Bullet summary shown on the results screen and the share card. */
  lines: string[]
}

/* ------------------------------------------------------------------ rules doc */

export interface RulesSection {
  title: string
  body: string[]
}

export interface RulesExample {
  title: string
  rows: { label: string; value: string; emphasis?: boolean }[]
  result: string
}

export interface RulesDoc {
  /** 1–2 sentences. Readable before the first tee. */
  summary: string
  sections: RulesSection[]
  /** Worked example with the CURRENT settings applied. */
  example?: RulesExample
  variations: { name: string; text: string; active?: boolean }[]
  definitions?: { term: string; text: string }[]
}

/* --------------------------------------------------------------- game module */

export type GameId = 'wolf' | 'skins' | 'nassau' | 'vegas' | 'dots' | 'team_match_play'

export interface GameMeta {
  id: GameId
  name: string
  emoji: string
  tagline: string
  /** e.g. "3–4 Players" */
  playersLabel: string
  minPlayers: number
  maxPlayers: number
  bestFor: string
  complexity: 1 | 2 | 3 | 4 | 5
  strategy: 1 | 2 | 3 | 4 | 5
  complexityLabel: string
  strategyLabel: string
  swing: 'Low' | 'Medium' | 'High' | 'Very High'
  /** Accent token key used by the game card / hole screen. */
  accent: 'wolf' | 'skins' | 'nassau' | 'vegas' | 'dots' | 'match'
}

export interface GameContext {
  players: Player[]
  course: Course
  settings: SettingsValues
  gameState: Record<string, any>
}

export interface GolfGame {
  meta: GameMeta
  settings: SettingDef[]
  /** Defaults derived from `settings`, plus anything not exposed in the UI. */
  defaultSettings(): SettingsValues
  /** Human message when the player count does not fit; null when fine. */
  validatePlayers(count: number): string | null
  /** Fresh round-level state (teams, press log, ...). */
  createRoundState(ctx: Omit<GameContext, 'gameState'>): Record<string, any>
  /** Pure fold over all entries -> everything the UI shows. */
  compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound
  finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult
  explain(settings: SettingsValues): RulesDoc
  /** Extra step the hole screen runs before score entry. */
  preScoreStage?: 'wolfPick' | 'teams' | null
}
