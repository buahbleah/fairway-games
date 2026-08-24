import { useCallback, useEffect, useState } from 'react'
import { api, type FriendsPayload } from '../net/api'
import { useAccount } from '../state/account'
import { useRouter } from '../state/router'
import { AppBar, Avatar, useToast } from '../ui/components'
import { EmptyGreen } from '../ui/art'
import { Check, Close, Plus } from '../ui/icons'

/**
 * Friends. You ask by email address; nothing is emailed. If they already have an
 * account the request is waiting when they open the app, and if they do not, it
 * attaches itself the moment they sign up with that address.
 */
export function FriendsScreen() {
  const { account } = useAccount()
  const { go } = useRouter()
  const { showToast, toastNode } = useToast()
  const [data, setData] = useState<FriendsPayload | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api.friends())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your friends.')
    }
  }, [])

  useEffect(() => {
    if (account) void load()
  }, [account, load])

  if (!account) {
    return (
      <div className="page">
        <AppBar title="Friends" />
        <div className="empty">
          <EmptyGreen className="empty__art" />
          <h2 className="empty__title">Sign in to add friends</h2>
          <p className="empty__text">
            A friends list makes setting up a round two taps instead of typing four names.
          </p>
          <button className="btn btn--primary" onClick={() => go('/account')}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.addFriend(email.trim())
      showToast({
        message:
          result.status === 'accepted'
            ? 'You are friends now.'
            : result.hasAccount
              ? 'Request sent.'
              : 'Saved — it will reach them when they sign up.',
      })
      setEmail('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that request.')
    } finally {
      setBusy(false)
    }
  }

  const respond = async (id: string, action: 'accept' | 'decline') => {
    try {
      await api.respondFriend(id, action)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not do that.')
    }
  }

  return (
    <div className="page">
      <AppBar title="Friends" />

      <div className="stack stack-5">
        <div className="stack stack-2">
          <label className="field__label" htmlFor="friend-email">
            Add by email
          </label>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <input
              id="friend-email"
              className="input grow"
              type="email"
              inputMode="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn btn--primary"
              style={{ minWidth: 64, padding: 0 }}
              disabled={!email.trim() || busy}
              onClick={add}
              aria-label="Send friend request"
            >
              <Plus />
            </button>
          </div>
          {error && (
            <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>
              {error}
            </p>
          )}
        </div>

        {data && data.incoming.length > 0 && (
          <section className="stack stack-2">
            <h2 className="section-title">Waiting for you</h2>
            {data.incoming.map((req) => (
              <div key={req.id} className="card card--tight row" style={{ gap: 'var(--s-3)' }}>
                <Avatar player={{ ...req.from, id: req.from.id }} size="sm" />
                <span className="grow">
                  <span style={{ fontWeight: 700, display: 'block' }}>{req.from.name}</span>
                  <span className="t-sm muted">{req.from.email}</span>
                </span>
                <button
                  className="iconbtn"
                  style={{ color: 'var(--good)' }}
                  aria-label={`Accept ${req.from.name}`}
                  onClick={() => respond(req.id, 'accept')}
                >
                  <Check />
                </button>
                <button
                  className="iconbtn iconbtn--ghost"
                  aria-label={`Decline ${req.from.name}`}
                  onClick={() => respond(req.id, 'decline')}
                >
                  <Close />
                </button>
              </div>
            ))}
          </section>
        )}

        <section className="stack stack-2">
          <h2 className="section-title">Your friends</h2>
          {!data ? (
            <p className="t-sm muted">Loading…</p>
          ) : data.friends.length === 0 ? (
            <p className="t-sm muted">Nobody yet. Add someone with their email above.</p>
          ) : (
            data.friends.map((f) => (
              <div key={f.id} className="card card--tight row" style={{ gap: 'var(--s-3)' }}>
                <Avatar player={{ ...f }} size="sm" />
                <span className="grow">
                  <span style={{ fontWeight: 700, display: 'block' }}>{f.name}</span>
                  <span className="t-sm muted">
                    {f.handicapIndex != null ? `HCP ${f.handicapIndex.toFixed(1)}` : f.email}
                  </span>
                </span>
              </div>
            ))
          )}
        </section>

        {data && data.outgoing.length > 0 && (
          <section className="stack stack-2">
            <h2 className="section-title">Sent</h2>
            {data.outgoing.map((o) => (
              <div key={o.id} className="card card--tight row-between">
                <span className="t-sm">{o.email}</span>
                <span className="chip">{o.hasAccount ? 'Waiting' : 'Not signed up yet'}</span>
              </div>
            ))}
          </section>
        )}
      </div>
      {toastNode}
    </div>
  )
}
