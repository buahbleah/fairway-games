import { useState } from 'react'
import { parseDots, serializeDots, type DotDef } from '../games/dots/dotTypes'
import { Sheet, Stepper, Switch } from '../ui/components'
import { Plus, Trash } from '../ui/icons'

/**
 * The Dot Builder. Every group's junk game is different, so all of it is
 * editable: on/off, name, value, sign, and your own additions.
 */
export function DotBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dots = parseDots(value)
  const [editing, setEditing] = useState<DotDef | null>(null)
  const [adding, setAdding] = useState(false)

  const update = (next: DotDef[]) => onChange(serializeDots(next))
  const patch = (id: string, p: Partial<DotDef>) => update(dots.map((d) => (d.id === id ? { ...d, ...p } : d)))

  return (
    <div className="stack stack-2">
      <div className="field__help">
        Tap a dot to rename it or change what it is worth. Switch off anything your group does not
        play.
      </div>

      {dots.map((dot) => (
        <div key={dot.id} className="card card--tight" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
          <button
            className="grow"
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--s-3)', minHeight: 44 }}
            onClick={() => setEditing(dot)}
          >
            <span style={{ fontSize: 22 }} aria-hidden>
              {dot.emoji}
            </span>
            <span className="grow">
              <span style={{ fontWeight: 700, display: 'block' }}>{dot.name}</span>
              <span className="t-sm muted">{dot.auto ? 'Automatic' : 'Tap it in after the hole'}</span>
            </span>
            <span
              className={`chip ${dot.points < 0 ? 'chip--bad' : 'chip--good'}`}
              style={{ minWidth: 52, justifyContent: 'center' }}
            >
              {dot.points > 0 ? `+${dot.points}` : dot.points}
            </span>
          </button>
          <Switch checked={dot.enabled} onChange={(v) => patch(dot.id, { enabled: v })} label={`${dot.name} on or off`} />
        </div>
      ))}

      <button className="btn btn--secondary btn--block" onClick={() => setAdding(true)}>
        <Plus size={18} /> Add a dot
      </button>

      <DotEditor
        dot={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          patch(next.id, next)
          setEditing(null)
        }}
        onDelete={
          editing?.custom
            ? () => {
                update(dots.filter((d) => d.id !== editing.id))
                setEditing(null)
              }
            : undefined
        }
      />

      <DotEditor
        dot={
          adding
            ? {
                id: `custom_${Date.now().toString(36)}`,
                name: 'New dot',
                emoji: '⭐',
                points: 1,
                auto: null,
                enabled: true,
                description: 'Whatever your group plays for.',
                custom: true,
              }
            : null
        }
        isNew
        onClose={() => setAdding(false)}
        onSave={(next) => {
          update([...dots, next])
          setAdding(false)
        }}
      />
    </div>
  )
}

const EMOJI_CHOICES = ['⭐', '🐦', '🦅', '🎯', '🏖', '⛳', '🐍', '📏', '🚩', '🌳', '💥', '🔥', '🍀', '💰']

function DotEditor({
  dot,
  onClose,
  onSave,
  onDelete,
  isNew,
}: {
  dot: DotDef | null
  onClose: () => void
  onSave: (d: DotDef) => void
  onDelete?: () => void
  isNew?: boolean
}) {
  const [draft, setDraft] = useState<DotDef | null>(dot)
  if (dot && (!draft || draft.id !== dot.id)) setDraft(dot)
  if (!dot || !draft) return null

  const negative = draft.points < 0

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'New dot' : draft.name}
      footer={
        <div className="stack stack-2">
          <button className="btn btn--primary btn--block" onClick={() => onSave(draft)}>
            {isNew ? 'Add dot' : 'Save'}
          </button>
          {onDelete && (
            <button className="btn btn--danger btn--block" onClick={onDelete}>
              <Trash size={18} /> Delete
            </button>
          )}
        </div>
      }
    >
      <div className="stack stack-4">
        <div className="field">
          <label className="field__label" htmlFor="dot-name">
            Name
          </label>
          <input
            id="dot-name"
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>

        <div className="field">
          <div className="field__label">Mark</div>
          <div className="row-wrap">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                className={`selectchip${draft.emoji === e ? ' is-selected' : ''}`}
                style={{ minWidth: 52, fontSize: 20 }}
                onClick={() => setDraft({ ...draft, emoji: e })}
                aria-label={`Use ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="row-between">
            <div className="grow">
              <div className="field__label">Worth</div>
              <div className="field__help">How many points this dot pays.</div>
            </div>
            <Stepper
              value={Math.abs(draft.points)}
              min={0}
              max={20}
              label="Dot value"
              onChange={(v) => setDraft({ ...draft, points: negative ? -v : v })}
            />
          </div>
        </div>

        <div className="field">
          <div className="row-between">
            <div className="grow">
              <div className="field__label">Penalty</div>
              <div className="field__help">Takes points away instead of giving them.</div>
            </div>
            <Switch
              checked={negative}
              label="Penalty dot"
              onChange={(v) => setDraft({ ...draft, points: v ? -Math.abs(draft.points) : Math.abs(draft.points) })}
            />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="dot-desc">
            What earns it
          </label>
          <div className="field__help">
            Written out so nobody has to argue about it on the 14th tee.
          </div>
          <textarea
            id="dot-desc"
            className="input"
            style={{ minHeight: 84, padding: 'var(--s-3) var(--s-4)', lineHeight: 1.4 }}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
      </div>
    </Sheet>
  )
}
