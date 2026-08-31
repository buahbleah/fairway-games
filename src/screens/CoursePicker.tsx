import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../net/api'
import {
  buildCourse,
  toExternalCourse,
  toSearchResults,
  type CourseSearchResult,
  type ExternalCourse,
} from '../core/externalCourse'
import type { Course } from '../core/types'
import { Check, Close } from '../ui/icons'

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
  const inputRef = useRef<HTMLInputElement>(null)

  // Choosing a course elsewhere (a preset, going back a step) has to be visible.
  useEffect(() => {
    if (!value?.externalId) setSelected(null)
  }, [value?.externalId])

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

  /* ------------------------------------------------------------ chosen */

  if (value?.externalId) {
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
    </div>
  )
}
