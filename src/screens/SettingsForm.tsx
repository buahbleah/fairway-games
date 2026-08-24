import { useState } from 'react'
import type { GolfGame, SettingDef, SettingsValues } from '../core/types'
import { groupsOf, isVisible } from '../core/settings'
import { Segmented, Stepper, Switch } from '../ui/components'
import { DotBuilder } from './DotBuilder'
import { useStore } from '../state/store'

/**
 * One renderer for every game's settings. Games declare setting definitions;
 * nothing here knows what a Wolf or a Skin is. Advanced settings are folded
 * away by default — progressive disclosure, so the common case stays short.
 */
export function SettingsForm({
  game,
  values,
  onChange,
}: {
  game: GolfGame
  values: SettingsValues
  onChange: (v: SettingsValues) => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const groups = groupsOf(game.settings)
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value })

  const hasAdvanced = game.settings.some((d) => d.advanced && isVisible(d, values))

  return (
    <div className="stack stack-5">
      {groups.map((group) => {
        const defs = game.settings.filter(
          (d) => (d.group ?? 'Game') === group && isVisible(d, values) && (!d.advanced || showAdvanced),
        )
        if (!defs.length) return null
        return (
          <section key={group} className="stack stack-2">
            <h3 className="section-title">{group}</h3>
            {defs.map((def) => (
              <SettingRow key={def.key} def={def} values={values} onSet={set} />
            ))}
          </section>
        )
      })}

      {hasAdvanced && (
        <button className="btn btn--quiet" onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? 'Hide advanced options' : 'More options'}
        </button>
      )}
    </div>
  )
}

function SettingRow({
  def,
  values,
  onSet,
}: {
  def: SettingDef
  values: SettingsValues
  onSet: (key: string, value: unknown) => void
}) {
  const { prefs } = useStore()
  const value = values[def.key]

  if (def.type === 'toggle') {
    return (
      <div className="field">
        <div className="row-between">
          <div className="grow">
            <div className="field__label">{def.label}</div>
            {def.help && <div className="field__help">{def.help}</div>}
          </div>
          <Switch checked={!!value} onChange={(v) => onSet(def.key, v)} label={def.label} />
        </div>
      </div>
    )
  }

  if (def.type === 'choice') {
    const compact = def.options.length <= 3 && def.options.every((o) => o.label.length <= 12)
    return (
      <div className="field">
        <div className="field__label">{def.label}</div>
        {def.help && <div className="field__help">{def.help}</div>}
        {compact ? (
          <Segmented
            ariaLabel={def.label}
            value={String(value)}
            options={def.options.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => onSet(def.key, v)}
          />
        ) : (
          <div className="stack stack-2">
            {def.options.map((o) => (
              <button
                key={o.value}
                className={`playerpick${String(value) === o.value ? ' is-selected' : ''}`}
                onClick={() => onSet(def.key, o.value)}
                aria-pressed={String(value) === o.value}
              >
                <span className="playerpick__check" aria-hidden>
                  ✓
                </span>
                <span className="grow">
                  <span style={{ fontWeight: 700, display: 'block' }}>{o.label}</span>
                  {o.help && <span className="t-sm muted">{o.help}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (def.type === 'number' || def.type === 'currency') {
    const isMoney = def.type === 'currency'
    return (
      <div className="field">
        <div className="row-between">
          <div className="grow">
            <div className="field__label">
              {def.label}
              {isMoney && <span className="muted"> ({prefs.currency})</span>}
            </div>
            {def.help && <div className="field__help">{def.help}</div>}
          </div>
          <Stepper
            value={Number(value ?? def.default)}
            onChange={(v) => onSet(def.key, v)}
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            label={def.label}
            suffix={def.type === 'number' ? undefined : undefined}
          />
        </div>
        {'presets' in def && def.presets && def.presets.length > 0 && (
          <div className="row-wrap">
            {def.presets.map((p) => (
              <button
                key={p}
                className={`chip${Number(value) === p ? ' chip--good' : ''}`}
                onClick={() => onSet(def.key, p)}
              >
                {p}
                {def.type === 'number' && def.suffix ? ` ${def.suffix}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (def.type === 'holeValues') {
    const map = (value ?? {}) as Record<string, number>
    return (
      <div className="field">
        <div className="field__label">{def.label}</div>
        {def.help && <div className="field__help">{def.help}</div>}
        <div className="scroll-x">
          <div className="row" style={{ gap: 'var(--s-2)', paddingBottom: 4 }}>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => {
              const v = map[String(hole)]
              return (
                <button
                  key={hole}
                  className={`selectchip${v ? ' is-selected' : ''}`}
                  style={{ minWidth: 56, flexDirection: 'column', gap: 0, padding: '0 var(--s-2)' }}
                  onClick={() => {
                    const next = { ...map }
                    const cur = next[String(hole)] ?? 0
                    const step = cur >= 5 ? 0 : cur + 1
                    if (step === 0) delete next[String(hole)]
                    else next[String(hole)] = step
                    onSet(def.key, next)
                  }}
                >
                  <span style={{ fontSize: 'var(--text-2xs)', opacity: 0.7 }}>H{hole}</span>
                  <span>{v ? `${v}×` : '–'}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="field__help">Tap a hole to raise its value. Tap past 5 to clear it.</div>
      </div>
    )
  }

  if (def.type === 'dotBuilder') {
    return <DotBuilder value={String(value ?? '')} onChange={(v) => onSet(def.key, v)} />
  }

  return null
}
