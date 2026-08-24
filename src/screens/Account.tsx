import { useState } from 'react'
import { useRouter } from '../state/router'
import { useAccount } from '../state/account'
import { AppBar, Stepper } from '../ui/components'
import { BrandMark } from '../ui/art'

/**
 * Sign in or create an account. Everything here is optional — the app plays a
 * full round without it. An account is what unlocks friends, leagues and live
 * scoring across phones.
 */
export function AccountScreen() {
  const { go, back } = useRouter()
  const { account, login, register } = useAccount()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [handicap, setHandicap] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (account) {
    return (
      <div className="page">
        <AppBar title="Account" />
        <div className="empty">
          <BrandMark size={48} />
          <h2 className="empty__title">Signed in as {account.name}</h2>
          <p className="empty__text">{account.email}</p>
          <button className="btn btn--primary" onClick={() => go('/settings')}>
            Account settings
          </button>
        </div>
      </div>
    )
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'in') await login(email.trim(), password)
      else await register({ email: email.trim(), name: name.trim(), password, handicapIndex: handicap })
      back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    email.trim() && password.length >= 8 && (mode === 'in' || name.trim().length > 0) && !busy

  return (
    <div className="page">
      <AppBar title={mode === 'in' ? 'Sign in' : 'Create account'} />

      <div className="stack stack-5" style={{ paddingTop: 'var(--s-3)' }}>
        <div className="stack stack-2">
          <h1 className="t-title">{mode === 'in' ? 'Welcome back' : 'Play with your group'}</h1>
          <p className="t-sm muted">
            An account lets you keep a friends list, run a league, and score a round together — every
            phone shows the same card as it fills in. You can keep playing offline without one.
          </p>
        </div>

        <div className="stack stack-3">
          {mode === 'up' && (
            <div className="field">
              <label className="field__label" htmlFor="acc-name">
                Your name
              </label>
              <input
                id="acc-name"
                className="input"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marc"
              />
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="acc-email">
              Email
            </label>
            <input
              id="acc-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="acc-password">
              Password
            </label>
            <input
              id="acc-password"
              className="input"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'up' && <div className="field__help">At least 8 characters.</div>}
          </div>

          {mode === 'up' && (
            <div className="field">
              <div className="row-between">
                <div className="grow">
                  <div className="field__label">Handicap index</div>
                  <div className="field__help">
                    Optional, and only you can change yours. It is what lets a game even itself out
                    between players.
                  </div>
                </div>
                <Stepper
                  value={handicap ?? 0}
                  min={-10}
                  max={54}
                  step={0.5}
                  label="Handicap index"
                  onChange={setHandicap}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>
            {error}
          </p>
        )}

        <button className="btn btn--quiet" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null) }}>
          {mode === 'in' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
        </button>
      </div>

      <div className="actionbar">
        <button className="btn btn--primary btn--xl" disabled={!canSubmit} onClick={submit}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </div>
    </div>
  )
}
