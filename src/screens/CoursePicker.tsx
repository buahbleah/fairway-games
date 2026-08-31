import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../net/api'
import { uid, useStore } from '../state/store'
import { defaultHoles } from '../core/course'
import {
  buildCourse,
  toExternalCourse,
  toSearchResults,
  type CourseSearchResult,
  type ExternalCourse,
} from '../core/externalCourse'
import type { Course, Hole } from '../core/types'
import { Check, Close, Edit, Trash } from '../ui/icons'

/**
 * Picking the course the round is actually played on.
 *
 * This is what makes handicaps mean anything: shots are given on the hardest
 * holes first, and "hardest" is the card's stroke index, not a guess. Off a
 * standard card everyone gets their shots in the same made-up order.
 *
 * Search is deliberately manual — a button, not a keystroke. The course
 * database allows a few dozen calls a day across every user of the app, and
 * search-as-you-type would spend a week's worth on one club name.
 */
export function CoursePicker({
  value,
  onChange,
  onClear,
}: {
  value: Course | null
  onChange: (course: Course, warnings: string[]) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CourseSearchResult[] | null>(null)
  const [selected, setSelected] = useState<ExternalCourse | null>(null)
  const [raw, setRaw] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const store = useStore()

  // Choosing a course elsewhere (a preset, going back a step) has to be visible.
  useEffect(() => {
    if (!value?.id) setSelected(null)
  }, [value?.id])

  const search = async () => {
    const q = query.trim()
    if (q.length < 3) {
      setError('Type at least three letters of the club name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = await api.searchCourses(q)
      const found = toSearchResults(payload.results)
      setResults(found)
      if (!found.length) setError(`Nothing found for “${q}”. Try just the town, or the club name.`)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the course database. You can still set the card by hand.',
      )
    } finally {
      setBusy(false)
    }
  }

  const openCourse = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const payload = await api.course(id)
      const external = toExternalCourse(payload.course)
      if (!external || !external.tees.length) {
        setError('That course has no tee information, so it cannot be used for handicaps.')
        return
      }
      setRaw(payload.course)
      setSelected(external)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that course.')
    } finally {
      setBusy(false)
    }
  }

  const chooseTee = (teeId: string) => {
    const built = buildCourse(raw, teeId)
    if (!built) {
      setError('That tee could not be read.')
      return
    }
    onChange(built.course, built.warnings)
    setResults(null)
    setSelected(null)
  }

  /* -------------------------------------------------------- card editor */

  if (editing) {
    return (
      <CardEditor
        draft={editing}
        onCancel={() => setEditing(null)}
        onSave={(course) => {
          store.saveCourse(course)
          onChange(course, [])
          setEditing(null)
          setResults(null)
        }}
      />
    )
  }

  /* ------------------------------------------------------------ chosen */

  if (value?.id && value.id !== 'default') {
    return (
      <div className="card card--tight">
        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <span className="resume__mark" style={{ width: 36, height: 36, minWidth: 36 }}>
            <Check size={18} />
          </span>
          <span className="grow">
            <span style={{ fontWeight: 700, display: 'block' }}>{value.name}</span>
            <span className="t-sm muted">
              {value.teeName ? `${value.teeName} tees · ` : ''}
              {value.holes.length} holes
              {value.slopeRating ? ` · slope ${value.slopeRating}` : ''}
              {value.courseRating ? ` · CR ${value.courseRating}` : ''}
            </span>
          </span>
          <button className="iconbtn iconbtn--ghost" aria-label="Choose another course" onClick={onClear}>
            <Close size={18} />
          </button>
        </div>
      </div>
    )
  }

  /* -------------------------------------------------------- tee picker */

  if (selected) {
    return (
      <div className="stack stack-3">
        <div className="row-between">
          <span style={{ fontWeight: 700 }}>{selected.clubName}</span>
          <button className="btn btn--quiet" onClick={() => setSelected(null)}>
            Back
          </button>
        </div>
        <p className="field__help">Which tees are you playing off? The rating comes with them.</p>
        <div className="stack stack-2">
          {selected.tees.map((tee) => (
            <button key={tee.id} className="playerpick" onClick={() => chooseTee(tee.id)}>
              <span className="grow">
                <span style={{ fontWeight: 700, display: 'block' }}>
                  {tee.name}
                  <span className="t-sm muted" style={{ fontWeight: 400 }}>
                    {' '}
                    · {tee.gender === 'male' ? "men's" : "women's"}
                  </span>
                </span>
                <span className="t-sm muted">
                  {tee.courseRating ? `CR ${tee.courseRating}` : 'no rating'}
                  {tee.slopeRating ? ` · slope ${tee.slopeRating}` : ''}
                  {tee.parTotal ? ` · par ${tee.parTotal}` : ''}
                  {tee.holeCount ? ` · ${tee.holeCount} holes` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------ search */

  return (
    <div className="stack stack-3">
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <input
          ref={inputRef}
          className="input grow"
          placeholder="Club or town"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          aria-label="Search for a golf course"
        />
        <button className="btn btn--secondary" disabled={busy} onClick={search}>
          {busy ? '…' : 'Search'}
        </button>
      </div>

      {error && <p className="field__help" style={{ color: 'var(--bad)' }}>{error}</p>}

      {results && results.length > 0 && (
        <div className="stack stack-2">
          {results.slice(0, 12).map((r) => (
            <button key={r.id} className="playerpick" disabled={busy} onClick={() => openCourse(r.id)}>
              <span className="grow">
                <span style={{ fontWeight: 700, display: 'block' }}>{r.clubName}</span>
                <span className="t-sm muted">
                  {[r.courseName, r.location].filter(Boolean).join(' · ') || 'Course'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Courses typed in once. Plenty of clubs are in the database with no card
          attached at all, and a home course is worth five minutes exactly once. */}
      {store.courses.length > 0 && (
        <div className="stack stack-2">
          <div className="label">Your courses</div>
          {store.courses.map((c) => (
            <div key={c.id} className="row" style={{ gap: 'var(--s-2)' }}>
              <button className="playerpick grow" onClick={() => onChange(c, [])}>
                <span className="grow">
                  <span style={{ fontWeight: 700, display: 'block' }}>{c.name}</span>
                  <span className="t-sm muted">
                    {c.holes.length} holes
                    {c.slopeRating ? ` · slope ${c.slopeRating}` : ''}
                    {c.courseRating ? ` · CR ${c.courseRating}` : ''}
                  </span>
                </span>
              </button>
              <button
                className="iconbtn iconbtn--ghost"
                aria-label={`Edit ${c.name}`}
                onClick={() => setEditing(c)}
              >
                <Edit size={16} />
              </button>
              <button
                className="iconbtn iconbtn--ghost"
                aria-label={`Delete ${c.name}`}
                onClick={() => store.deleteCourse(c.id)}
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn--quiet" onClick={() => setEditing(blankCourse())}>
        Enter a card by hand
      </button>
    </div>
  )
}

function blankCourse(): Course {
  return {
    id: uid('course'),
    name: '',
    holes: defaultHoles(),
    slopeRating: 113,
  }
}

/**
 * Typing in a card.
 *
 * Par matters for reading a score; the stroke index is what decides where a
 * handicap's shots land, so that is the column the validation is strict about.
 * Two holes cannot share a rank — the shot would have nowhere to go.
 */
function CardEditor({
  draft,
  onSave,
  onCancel,
}: {
  draft: Course
  onSave: (course: Course) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(draft.name)
  const [holes, setHoles] = useState<Hole[]>(draft.holes)
  const [slope, setSlope] = useState(String(draft.slopeRating ?? 113))
  const [rating, setRating] = useState(draft.courseRating ? String(draft.courseRating) : '')

  const setHole = (index: number, patch: Partial<Hole>) =>
    setHoles((hs) => hs.map((h, i) => (i === index ? { ...h, ...patch } : h)))

  const setCount = (count: number) =>
    setHoles(
      Array.from({ length: count }, (_, i) => holes[i] ?? { number: i + 1, par: 4, strokeIndex: i + 1 }),
    )

  const duplicates = useMemo(() => {
    const seen = new Map<number, number>()
    for (const h of holes) seen.set(h.strokeIndex, (seen.get(h.strokeIndex) ?? 0) + 1)
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([si]) => si))
  }, [holes])

  const problem = !name.trim()
    ? 'Give the course a name.'
    : duplicates.size
      ? 'Two holes share a stroke index. Each one has to be different.'
      : null

  return (
    <div className="stack stack-3">
      <div className="row-between">
        <span style={{ fontWeight: 700 }}>The card</span>
        <button className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <input
        className="input"
        placeholder="Course name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Course name"
      />

      <div className="row" style={{ gap: 'var(--s-2)' }}>
        {[9, 18].map((n) => (
          <button
            key={n}
            className={`playerpick grow${holes.length === n ? ' is-selected' : ''}`}
            onClick={() => setCount(n)}
          >
            <span style={{ fontWeight: 700 }}>{n} holes</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <label className="grow">
          <span className="field__label">Slope</span>
          <input
            className="input"
            inputMode="numeric"
            value={slope}
            onChange={(e) => setSlope(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </label>
        <label className="grow">
          <span className="field__label">Course rating</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="optional"
            value={rating}
            onChange={(e) => setRating(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </label>
      </div>

      <div className="cardgrid">
        <div className="cardgrid__head">
          <span>Hole</span>
          <span>Par</span>
          <span>SI</span>
        </div>
        {holes.map((h, i) => (
          <div key={h.number} className="cardgrid__row">
            <span className="cardgrid__hole">{h.number}</span>
            <input
              className="input input--tight"
              inputMode="numeric"
              aria-label={`Par on hole ${h.number}`}
              value={h.par}
              onChange={(e) => setHole(i, { par: Math.max(3, Math.min(6, Number(e.target.value) || 4)) })}
            />
            <input
              className={`input input--tight${duplicates.has(h.strokeIndex) ? ' is-bad' : ''}`}
              inputMode="numeric"
              aria-label={`Stroke index on hole ${h.number}`}
              value={h.strokeIndex}
              onChange={(e) =>
                setHole(i, { strokeIndex: Math.max(1, Math.min(18, Number(e.target.value) || 1)) })
              }
            />
          </div>
        ))}
      </div>

      {problem && <p className="field__help" style={{ color: 'var(--bad)' }}>{problem}</p>}

      <button
        className="btn btn--primary btn--block"
        disabled={!!problem}
        onClick={() =>
          onSave({
            ...draft,
            name: name.trim(),
            holes,
            slopeRating: Number(slope) || 113,
            courseRating: rating ? Number(rating) : undefined,
          })
        }
      >
        Save course
      </button>
    </div>
  )
}
