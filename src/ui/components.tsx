import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from '../state/router'
import { ChevronLeft, Close } from './icons'
import type { Player, StandingRow } from '../core/types'

/* --------------------------------------------------------------------- bar */

export function AppBar({
  title,
  onBack,
  right,
  bordered,
}: {
  title?: ReactNode
  onBack?: (() => void) | false
  right?: ReactNode
  bordered?: boolean
}) {
  const { back } = useRouter()
  const handleBack = onBack === false ? null : (onBack ?? back)
  return (
    <header className={`appbar${bordered ? ' appbar--bordered' : ''}`}>
      {handleBack ? (
        // Wrapped rather than passed directly: back() takes an optional fallback
        // path, so handing it the click event would navigate to nonsense.
        <button className="iconbtn" onClick={() => handleBack()} aria-label="Back">
          <ChevronLeft />
        </button>
      ) : (
        <span style={{ width: 8 }} />
      )}
      <span className="appbar__title">{title}</span>
      {right}
    </header>
  )
}

/* ------------------------------------------------------------------ avatar */

export function Avatar({ player, size = 'md' }: { player: Player; size?: 'sm' | 'md' | 'lg' }) {
  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const cls = size === 'sm' ? 'avatar avatar--sm' : size === 'lg' ? 'avatar avatar--lg' : 'avatar'

  if (player.avatarUrl) {
    return (
      <span className={`${cls} avatar--photo`} aria-hidden>
        <img src={player.avatarUrl} alt="" />
      </span>
    )
  }

  return (
    <span className={cls} style={{ background: `var(--avatar-${player.colorIndex % 6})` }} aria-hidden>
      {initials || '?'}
    </span>
  )
}

/* ------------------------------------------------------------------- sheet */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="sheet">
        <div className="sheet__grab" />
        {title && (
          <div className="row-between" style={{ marginBottom: 'var(--s-3)' }}>
            <h2 className="t-head">{title}</h2>
            <button className="iconbtn iconbtn--ghost" onClick={onClose} aria-label="Close">
              <Close />
            </button>
          </div>
        )}
        {children}
        {footer && <div style={{ marginTop: 'var(--s-5)' }}>{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ toggle */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  )
}

/* --------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className="segmented__item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------- stepper */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  suffix?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="stepper">
      <button
        className="stepper__btn"
        onClick={() => onChange(clamp(value - step))}
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
      >
        −
      </button>
      <span className="stepper__value" style={{ fontSize: 'var(--text-2xl)', minWidth: 78 }}>
        {value}
        {suffix ? <span style={{ fontSize: 'var(--text-sm)', marginLeft: 4 }}>{suffix}</span> : null}
      </span>
      <button
        className="stepper__btn"
        onClick={() => onChange(clamp(value + step))}
        aria-label={`Increase ${label}`}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  )
}

/* ------------------------------------------------------------- leaderboard */

export function Leaderboard({
  standings,
  players,
  compact,
  emptyText = 'Nothing scored yet.',
}: {
  standings: StandingRow[]
  players: Player[]
  compact?: boolean
  emptyText?: string
}) {
  if (!standings.length) return <p className="muted t-sm">{emptyText}</p>
  return (
    <ol className="lb">
      {standings.map((row) => {
        const player = players.find((p) => p.id === row.playerId)
        if (!player) return null
        const move = row.movement ?? 0
        return (
          <li
            key={row.playerId}
            className={`lb__row${row.rank === 1 ? ' lb__row--leader' : ''}`}
          >
            <span className="lb__rank num">{row.rank}</span>
            <Avatar player={player} size={compact ? 'sm' : 'md'} />
            <span className="grow">
              <span className="lb__name">{player.name}</span>
              {row.sub && <span className="lb__sub" style={{ display: 'block' }}>{row.sub}</span>}
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className="lb__value">{row.display}</span>
              {!compact && (
                <span
                  className={`lb__move ${
                    move > 0 ? 'lb__move--up' : move < 0 ? 'lb__move--down' : 'lb__move--flat'
                  }`}
                  style={{ display: 'block' }}
                >
                  {move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${-move}` : '—'}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------- toast */

export function Toast({
  message,
  action,
  onAction,
  onDone,
}: {
  message: string
  action?: string
  onAction?: () => void
  onDone: () => void
}) {
  const timer = useRef<number>()
  useEffect(() => {
    timer.current = window.setTimeout(onDone, 4200)
    return () => window.clearTimeout(timer.current)
  }, [message, onDone])
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {action && (
        <button
          className="toast__action"
          onClick={() => {
            onAction?.()
            onDone()
          }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; action?: string; onAction?: () => void } | null>(null)
  const node = toast ? (
    <Toast message={toast.message} action={toast.action} onAction={toast.onAction} onDone={() => setToast(null)} />
  ) : null
  return { showToast: setToast, toastNode: node }
}

/* --------------------------------------------------------------- collapse */

export function Collapse({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="collapse">
      <button className="collapse__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className={`collapse__chev${open ? ' is-open' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="collapse__body">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ rating */

export function Rating({ value, label }: { value: number; label: string }) {
  return (
    <span className="rating" aria-label={`${label}: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`rating__pip${i <= value ? ' is-on' : ''}`} aria-hidden />
      ))}
    </span>
  )
}
