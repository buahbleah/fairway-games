import { GAMES } from '../games/registry'
import { useStore } from '../state/store'
import { useAccount } from '../state/account'
import { useRouter } from '../state/router'
import { AppBar, Avatar, Segmented, Switch, useToast } from '../ui/components'
import { BrandMark } from '../ui/art'
import { PlayerIcon, Trash, Trophy } from '../ui/icons'

export function SettingsScreen() {
  const { prefs, setPrefs, presets, deletePreset, roster } = useStore()
  const { account } = useAccount()
  const { go } = useRouter()
  const { toastNode } = useToast()
  return (
    <div className="page">
      <AppBar title="Settings" />

      <div className="stack stack-6">
        {/* --------------------------------------------------------- account */}
        <section className="stack stack-3">
          <h2 className="section-title">Account</h2>

          {account ? (
            <>
              <div className="card row" style={{ gap: 'var(--s-3)' }}>
                <Avatar player={{ ...account }} size="lg" />
                <div className="grow">
                  <div className="t-head">{account.name}</div>
                  <div className="t-sm muted">{account.email}</div>
                </div>
              </div>

              <button className="btn btn--primary btn--block" onClick={() => go('/profile')}>
                Edit profile, photo and handicap
              </button>

              <div className="row" style={{ gap: 'var(--s-3)' }}>
                <button className="btn btn--secondary grow" onClick={() => go('/friends')}>
                  <PlayerIcon size={18} /> Friends
                </button>
                <button className="btn btn--secondary grow" onClick={() => go('/leagues')}>
                  <Trophy size={18} /> Leagues
                </button>
              </div>

            </>
          ) : (
            <button className="card card--interactive" onClick={() => go('/account')}>
              <div className="row" style={{ gap: 'var(--s-3)' }}>
                <span className="resume__mark">
                  <PlayerIcon size={22} />
                </span>
                <span className="grow">
                  <span style={{ fontWeight: 700, display: 'block' }}>Sign in or create an account</span>
                  <span className="t-sm muted">
                    For friends, leagues and scoring a round together. Playing on your own needs no
                    account at all.
                  </span>
                </span>
              </div>
            </button>
          )}
        </section>

        {/* ------------------------------------------------------ appearance */}
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

        {/* ---------------------------------------------------------- presets */}
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
                  <button
                    className="iconbtn iconbtn--ghost"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => deletePreset(p.id)}
                  >
                    <Trash size={20} />
                  </button>
                </div>
              )
            })
          )}
        </section>

        <section className="stack stack-3">
          <h2 className="section-title">Guests on this phone</h2>
          <p className="t-sm muted">
            {roster.length
              ? `${roster.length} saved. Guests are people you keep score for who do not have an account.`
              : 'Guests you add during setup are remembered here.'}
          </p>
        </section>

        {/* ------------------------------------------------------------ about */}
        <section className="stack stack-3">
          <h2 className="section-title">About</h2>
          <div className="card stack stack-3" style={{ alignItems: 'center', textAlign: 'center' }}>
            <BrandMark size={48} />
            <div>
              <div className="t-head">Fairway Games</div>
              <div className="t-sm muted">Version 1.1</div>
            </div>
            <p className="t-sm muted">
              Rounds you play on your own stay on this phone. If you sign in, your name, email,
              handicap and the rounds you share are stored on our server so your group can see them —
              nothing else is collected, and there are no trackers or ads.
            </p>
            <button className="btn btn--quiet btn--block" onClick={() => go('/privacy')}>
              Privacy policy
            </button>
            <p className="t-sm muted">
              Every round keeps working with no signal. Scores you enter offline are saved here and
              sent on as soon as you have a connection.
            </p>
          </div>
        </section>
      </div>
      {toastNode}
    </div>
  )
}
