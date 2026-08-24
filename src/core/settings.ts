/**
 * Shared setting building blocks.
 *
 * Games declare WHICH settings they need; they never re-implement the control,
 * the label, the help text or the defaults. Anything that appears in more than
 * one game lives here.
 */

import type { ChoiceSetting, CurrencySetting, NumericSetting, SettingDef, SettingsValues, ToggleSetting } from './types'

export function num(
  key: string,
  label: string,
  def: number,
  opts: Partial<NumericSetting> = {},
): NumericSetting {
  return { type: 'number', key, label, default: def, min: 0, max: 99, step: 1, ...opts }
}

export function toggle(key: string, label: string, def: boolean, opts: Partial<ToggleSetting> = {}): ToggleSetting {
  return { type: 'toggle', key, label, default: def, ...opts }
}

export function choice(
  key: string,
  label: string,
  def: string,
  options: ChoiceSetting['options'],
  opts: Partial<ChoiceSetting> = {},
): ChoiceSetting {
  return { type: 'choice', key, label, default: def, options, ...opts }
}

export function currency(key: string, label: string, def: number, opts: Partial<CurrencySetting> = {}): CurrencySetting {
  return { type: 'currency', key, label, default: def, min: 0, max: 1000, step: 0.5, ...opts }
}

/* ------------------------------------------------------------ shared settings */

export const SCORING_GROUP = 'Scoring'
export const STAKES_GROUP = 'Stakes'

/** Gross or Net. Every stroke-comparing game gets the same control. */
export const grossNetSetting = (): SettingDef =>
  choice('scoring', 'Score used', 'gross', [
    { value: 'gross', label: 'Gross', help: 'Raw strokes. No shots given.' },
    { value: 'net', label: 'Net', help: 'Strokes minus handicap shots on that hole.' },
  ], { group: SCORING_GROUP, help: 'Net needs a handicap for each player.' })

export const handicapSettings = (defaultAllowance: number, allowanceHelp: string): SettingDef[] => [
  toggle('handicapEnabled', 'Handicaps', false, {
    group: SCORING_GROUP,
    help: 'Give shots based on each player’s handicap index and the hole stroke index.',
  }),
  num('handicapAllowance', 'Handicap allowance', defaultAllowance, {
    group: SCORING_GROUP,
    min: 25,
    max: 100,
    step: 5,
    suffix: '%',
    presets: [50, 75, 85, 90, 95, 100],
    help: allowanceHelp,
    visibleWhen: (s) => !!s.handicapEnabled,
    advanced: true,
  }),
  choice('handicapMode', 'Shots are given', 'difference', [
    { value: 'difference', label: 'Off the low player', help: 'Best player plays scratch. Standard for match formats.' },
    { value: 'full', label: 'Full allocation', help: 'Everyone receives their whole allowance.' },
  ], { group: SCORING_GROUP, visibleWhen: (s) => !!s.handicapEnabled, advanced: true }),
]

export const pointValueSetting = (): SettingDef =>
  currency('pointValue', 'Value of one point', 0, {
    group: STAKES_GROUP,
    help: 'Optional. Leave at 0 to keep the game in points only.',
    presets: undefined,
  } as Partial<CurrencySetting>)

/* --------------------------------------------------------------------- utils */

export function defaultsFrom(defs: SettingDef[]): SettingsValues {
  const out: SettingsValues = {}
  for (const d of defs) out[d.key] = d.default
  return out
}

export function isVisible(def: SettingDef, values: SettingsValues): boolean {
  return def.visibleWhen ? def.visibleWhen(values) : true
}

export function groupsOf(defs: SettingDef[]): string[] {
  const seen: string[] = []
  for (const d of defs) {
    const g = d.group ?? 'Game'
    if (!seen.includes(g)) seen.push(g)
  }
  return seen
}

/** Formats a points total as money when a point value is configured. */
export function moneyLabel(points: number, pointValue: number, currencyCode = 'CHF'): string | undefined {
  if (!pointValue) return undefined
  const amount = points * pointValue
  const sign = amount < 0 ? '-' : ''
  return `${sign}${currencyCode} ${Math.abs(amount).toFixed(2)}`
}
