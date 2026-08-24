import { useRef, useState } from 'react'
import { useAccount } from '../state/account'
import { useRouter } from '../state/router'
import { api } from '../net/api'
import { AppBar, Avatar, Sheet, Stepper, useToast } from '../ui/components'
import { Check, PlayerIcon, Trash } from '../ui/icons'

/**
 * Your own profile. Nobody else can edit any of this — a handicap in particular
 * is the player's to set, which is why there is no way to change someone else's.
 */
export function ProfileScreen() {
  const { account, updateProfile, logout } = useAccount()
  const { go } = useRouter()
  const { showToast, toastNode } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(account?.name ?? '')
  const [handicap, setHandicap] = useState<number | null>(account?.handicapIndex ?? null)
  const [colorIndex, setColorIndex] = useState(account?.colorIndex ?? 0)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(account?.avatarUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  if (!account) {
    return (
      <div className="page">
        <AppBar title="Profile" />
        <div className="empty">
          <PlayerIcon size={44} className="faint" />
          <h2 className="empty__title">Not signed in</h2>
          <p className="empty__text">Sign in to keep a profile, a handicap and a friends list.</p>
          <button className="btn btn--primary" onClick={() => go('/account')}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const dirty =
    name.trim() !== account.name ||
    handicap !== account.handicapIndex ||
    colorIndex !== account.colorIndex ||
    avatarUrl !== (account.avatarUrl ?? null)

  /**
   * Photos off a phone camera are several megabytes. Shrink to 256px square and
   * re-encode before it ever leaves the device — the avatar is never shown
   * larger than 52px, and a small image keeps the round payload light.
   */
  const pickImage = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      const size = 256
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')

      // Cover-crop: fill the square from the middle of the photo.
      const scale = Math.max(size / bitmap.width, size / bitmap.height)
      const w = bitmap.width * scale
      const h = bitmap.height * scale
      ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
      bitmap.close?.()

      setAvatarUrl(canvas.toDataURL('image/jpeg', 0.82))
    } catch {
      setError('That image could not be read. Try another one.')
    }
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateProfile({ name: name.trim(), handicapIndex: handicap, colorIndex, avatarUrl })
      showToast({ message: 'Profile saved' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const preview = { id: account.id, name: name || account.name, colorIndex, avatarUrl, handicapIndex: handicap }

  return (
    <div className="page">
      <AppBar title="Profile" />

      <div className="stack stack-5">
        {/* ---------------------------------------------------------- photo */}
        <section className="stack stack-3" style={{ alignItems: 'center' }}>
          <div className="profilepic">
            <Avatar player={preview} size="lg" />
          </div>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button className="btn btn--secondary" onClick={() => fileRef.current?.click()}>
              {avatarUrl ? 'Change photo' : 'Add a photo'}
            </button>
            {avatarUrl && (
              <button className="btn btn--quiet" onClick={() => setAvatarUrl(null)}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void pickImage(file)
              e.target.value = ''
            }}
          />
          <p className="t-sm muted center" style={{ maxWidth: '34ch' }}>
            The photo is shrunk on your phone before it is sent, and only your playing partners see
            it.
          </p>
        </section>

        {/* --------------------------------------------------------- colour */}
        <section className="stack stack-2">
          <h2 className="section-title">Your colour</h2>
          <p className="t-sm muted">Used on the scorecard when you have no photo.</p>
          <div className="row-wrap">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                className={`swatch${colorIndex === i ? ' is-selected' : ''}`}
                style={{ background: `var(--avatar-${i})` }}
                aria-label={`Colour ${i + 1}`}
                aria-pressed={colorIndex === i}
                onClick={() => setColorIndex(i)}
              >
                {colorIndex === i && <Check size={18} />}
              </button>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------------- name */}
        <section className="stack stack-2">
          <h2 className="section-title">Details</h2>
          <div className="field">
            <label className="field__label" htmlFor="profile-name">
              Name
            </label>
            <input
              id="profile-name"
              className="input"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="row-between">
              <div className="grow">
                <div className="field__label">Handicap index</div>
                <div className="field__help">
                  Only you can change yours. Games set to even things up give shots from this, on the
                  hardest holes first.
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
            {handicap === null && (
              <button className="btn btn--quiet" onClick={() => setHandicap(18)}>
                Set a handicap
              </button>
            )}
            {handicap !== null && (
              <button className="btn btn--quiet" onClick={() => setHandicap(null)}>
                I play off scratch / no handicap
              </button>
            )}
          </div>

          <div className="field">
            <div className="field__label">Email</div>
            <div className="field__help">{account.email} — used to add you as a friend.</div>
          </div>
        </section>

        {error && (
          <p className="chip chip--bad" style={{ display: 'block', padding: 'var(--s-3)' }}>
            {error}
          </p>
        )}

        {/* -------------------------------------------------------- account */}
        <section className="stack stack-2">
          <h2 className="section-title">Account</h2>
          <button
            className="btn btn--secondary btn--block"
            onClick={async () => {
              await logout()
              showToast({ message: 'Signed out' })
              go('/')
            }}
          >
            Sign out
          </button>
          <button className="btn btn--quiet btn--block" onClick={() => setConfirmDelete(true)}>
            Delete my account
          </button>
        </section>
      </div>

      <div className="actionbar">
        <button className="btn btn--primary btn--xl" disabled={!dirty || busy || !name.trim()} onClick={save}>
          {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account">
        <div className="stack stack-3">
          <p className="t-sm">
            This removes your account, your friends list, the leagues you own and every round you
            started. It cannot be undone.
          </p>
          <p className="t-sm muted">
            Rounds you played in that somebody else started will stay with them, without your name
            attached.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="delete-confirm">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm"
              className="input"
              value={deleteText}
              autoCapitalize="characters"
              onChange={(e) => setDeleteText(e.target.value)}
            />
          </div>
          <button
            className="btn btn--danger btn--block"
            disabled={deleteText.trim().toUpperCase() !== 'DELETE' || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await api.deleteAccount()
                await logout()
                go('/')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete the account.')
                setBusy(false)
                setConfirmDelete(false)
              }
            }}
          >
            <Trash size={18} /> Delete for good
          </button>
        </div>
      </Sheet>

      {toastNode}
    </div>
  )
}
