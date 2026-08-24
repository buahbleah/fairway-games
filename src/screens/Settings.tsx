import { GAMES } from '../games/registry'
import { useStore } from '../state/store'
import { AppBar, Segmented, Switch } from '../ui/components'
import { BrandMark } from '../ui/art'
import { Trash } from '../ui/icons'

export function SettingsScreen() {
  const { prefs, setPrefs, presets, deletePreset, roster } = useStore()

  return (
    <div className="page">
      <AppBar title="Settings" />

      <div className="stack stack-6">
        <section className="stack stack-3">
          <h2 className="section-title">Appearance</h2>

          <div className="field">
            <div className="field__label">Theme</div>
            <div className="field__help">Dark mode is its own design, not an inversion.</div>
            <Segmented
              ariaLabel="Theme"
              value={prefs.theme}
              onChange={(v) => setPrefs({ theme: v })}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>

          <div className="field">
            <div className="row-between">
              <div className="grow">
                <div className="field__label">Sunlight mode</div>
                <div className="field__help">
                  Maximum contrast, no soft fills, heavier type. For bright days and sunglasses.
                </div>
              </div>
              <Switch
                checked={prefs.contrast === 'sunlight'}
                label="Sunlight mode"
                onChange={(v) => setPrefs({ contrast: v ? 'sunlight' : 'normal' })}
              />
            </div>
          </div>

          <div className="field">
            <div className="row-between">
              <div className="grow">
                <div className="field__label">Haptics</div>
                <div className="field__help">
                  A short buzz when a hole is confirmed or a match is won. Nothing on every tap.
                </div>
              </div>
              <Switch checked={prefs.haptics} label="Haptics" onChange={(v) => setPrefs({ haptics: v })} />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="currency">
              Currency label
            </label>
            <div className="field__help">
              Only used when a game has a money value per point. Points work fine on their own.
            </div>
            <input
              id="currency"
              className="input"
              value={prefs.currency}
              onChange={(e) => setPrefs({ currency: e.target.value.slice(0, 4).toUpperCase() })}
            />
          </div>
        </section>

        <section className="stack stack-3">
          <h2 className="section-title">Saved setups</h2>
          {presets.length === 0 ? (
            <p className="t-sm muted">
              Save a game's settings during round setup and it appears here — one tap next time.
            </p>
          ) : (
            presets.map((p) => {
              const game = GAMES.find((g) => g.meta.id === p.gameId)
              return (
                <div key={p.id} className="row" style={{ gap: 'var(--s-2)' }}>
                  <div className="card card--tight grow">
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="t-sm muted">{game?.meta.name}</div>
                  </div>
                  <button className="iconbtn iconbtn--ghost" aria-label={`Delete ${p.name}`} onClick={() => deletePreset(p.id)}>
                    <Trash size={20} />
                  </button>
                </div>
              )
            })
          )}
        </section>

        <section className="stack stack-3">
          <h2 className="section-title">Players</h2>
          <p className="t-sm muted">
            {roster.length
              ? `${roster.length} players saved on this phone.`
              : 'Players you add during setup are remembered here.'}
          </p>
        </section>

        <section className="stack stack-3">
          <h2 className="section-title">About</h2>
          <div className="card stack stack-3" style={{ alignItems: 'center', textAlign: 'center' }}>
            <BrandMark size={48} />
            <div>
              <div className="t-head">Fairway Games</div>
              <div className="t-sm muted">Version 1.0</div>
            </div>
            <p className="t-sm muted">
              Works with no signal. Everything you enter stays on this phone — no account, no cloud,
              nothing sent anywhere.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
