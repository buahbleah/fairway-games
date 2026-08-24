import { useCallback, useEffect, useState } from 'react'
import { api, type League } from '../net/api'
import { useAccount } from '../state/account'
import { useRouter } from '../state/router'
import { AppBar, Sheet, useToast } from '../ui/components'
import { EmptyGreen } from '../ui/art'
import { Plus, Trophy } from '../ui/icons'

/**
 * Leagues are the standing group: the people you always play with, and every
 * round the group has ever played.
 */
export function LeaguesScreen() {
  const { account } = useAccount()
  const { go } = useRouter()
  const { showToast, toastNode } = useToast()
  const [leagues, setLeagues] = useState<League[] | null>(null)
  const [sheet, setSheet] = useState<null | 'create' | 'join'>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { leagues } = await api.leagues()
      setLeagues(leagues)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your leagues.')
    }
  }, [])

  useEffect(() => {
    if (account) void load()
  }, [account, load])

  if (!account) {
    return (
      <div className="page">
        <AppBar title="Leagues" />
        <div className="empty">
          <EmptyGreen className="empty__art" />
          <h2 className="empty__title">Sign in to start a league</h2>
          <p className="empty__text">
            A league keeps your group together and every round you have played in one place.
          </p>
          <button className="btn btn--primary" onClick={() => go('/account')}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const { league } = await api.createLeague({ name: name.trim() })
      setName('')
      setSheet(null)
      await load()
      showToast({ message: `${league.name} created — code ${league.joinCode}` })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that league.')
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    setBusy(true)
    setError(null)
    try {
      const league = await api.joinLeague(code.trim())
      setCode('')
      setSheet(null)
      await load()
      showToast({ message: `Joined ${league.name}` })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that league.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <AppBar title="Leagues" />

      <div className="stack stack-3">
        {!leagues ? (
          <p className="t-sm muted">Loading…</p>
        ) : leagues.length === 0 ? (
          <div className="empty">
            <EmptyGreen className="empty__art" />
            <h2 className="empty__title">No leagues yet</h2>
            <p className="empty__text">
              Start one for your regular group, then share the code so they can join.
            </p>
          </div>
        ) : (
          leagues.map((l) => (
            <button key={l.id} className="card card--interactive" onClick={() => go(`/league/${l.id}`)}>
              <div className="row-between">
                <div style={{ minWidth: 0 }}>
                  <div className="t-head">{l.name}</div>
                  <div className="t-sm muted">
                    {l.memberCount} {l.memberCount === 1 ? 'member' : 'members'} · {l.roundCount}{' '}
                    {l.roundCount === 1 ? 'round' : 'rounds'}
                  </div>
                </div>
                <span className="chip chip--accent">{l.joinCode}</span>
              </div>
            </button>
          ))
        )}

        {error && (
          <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>
            {error}
          </p>
        )}
      </div>

      <div className="actionbar">
        <button className="btn btn--secondary" onClick={() => setSheet('join')}>
          Join with code
        </button>
        <button className="btn btn--primary" onClick={() => setSheet('create')}>
          <Plus size={18} /> New league
        </button>
      </div>

      <Sheet open={sheet === 'create'} onClose={() => setSheet(null)} title="New league">
        <div className="stack stack-3">
          <p className="t-sm muted">
            Give it a name your group will recognise — "Thursday Boys", "Mallorca 2026".
          </p>
          <input
            className="input"
            value={name}
            placeholder="Thursday Boys"
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn--primary btn--block" disabled={!name.trim() || busy} onClick={create}>
            <Trophy size={18} /> Create
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'join'} onClose={() => setSheet(null)} title="Join a league">
        <div className="stack stack-3">
          <p className="t-sm muted">Ask whoever set it up for the six-character code.</p>
          <input
            className="input"
            value={code}
            placeholder="ABC123"
            autoCapitalize="characters"
            style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700 }}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn btn--primary btn--block" disabled={!code.trim() || busy} onClick={join}>
            Join
          </button>
        </div>
      </Sheet>

      {toastNode}
    </div>
  )
}
