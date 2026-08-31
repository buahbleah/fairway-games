import type { Course, Hole } from './types'
import { defaultHoles } from './course'

/**
 * Turning a GolfCourseAPI course into one of ours.
 *
 * Kept as pure functions with no fetch in sight, so the shape can be tested
 * against recorded payloads instead of against somebody's live quota.
 *
 * The parsing is deliberately forgiving. A public course database is filled in
 * by many hands: tees go missing, stroke indexes come through as zeroes or as
 * duplicates, nine-hole cards are filed as eighteen. A round that starts with a
 * slightly wrong card is far better than one that cannot start at all, so every
 * gap falls back to something sane and `warnings` says what was patched.
 */

export interface CourseTee {
  /** Stable within one course payload — "male:0", "female:2". */
  id: string
  name: string
  gender: 'male' | 'female'
  courseRating: number | null
  slopeRating: number | null
  parTotal: number | null
  yards: number | null
  holeCount: number
}

export interface ExternalCourse {
  id: string
  clubName: string
  courseName: string
  location: string | null
  tees: CourseTee[]
}

export interface CourseSearchResult {
  id: string
  clubName: string
  courseName: string
  location: string | null
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n !== 0 ? n : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function locationLabel(location: any): string | null {
  if (!location || typeof location !== 'object') return null
  const parts = [text(location.city), text(location.state), text(location.country)].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** The list a search returns — enough to pick from, nothing more. */
export function toSearchResults(payload: any): CourseSearchResult[] {
  const list = Array.isArray(payload?.courses) ? payload.courses : []
  return list
    .map((c: any) => ({
      id: String(c?.id ?? ''),
      clubName: text(c?.club_name) || text(c?.course_name) || 'Unnamed club',
      courseName: text(c?.course_name),
      location: locationLabel(c?.location),
    }))
    .filter((c: CourseSearchResult) => c.id)
}

/** Every tee on the card, both genders, in the order the API lists them. */
export function toTees(course: any): CourseTee[] {
  const groups: Array<['male' | 'female', any]> = [
    ['male', course?.tees?.male],
    ['female', course?.tees?.female],
  ]
  const tees: CourseTee[] = []
  for (const [gender, list] of groups) {
    if (!Array.isArray(list)) continue
    list.forEach((t: any, i: number) => {
      const holes = Array.isArray(t?.holes) ? t.holes : []
      tees.push({
        id: `${gender}:${i}`,
        name: text(t?.tee_name) || `Tee ${i + 1}`,
        gender,
        courseRating: num(t?.course_rating),
        slopeRating: num(t?.slope_rating),
        parTotal: num(t?.par_total),
        yards: num(t?.total_yards),
        holeCount: holes.length || num(t?.number_of_holes) || 0,
      })
    })
  }
  return tees
}

export function toExternalCourse(payload: any): ExternalCourse | null {
  const course = payload?.course ?? payload
  const id = String(course?.id ?? '')
  if (!id) return null
  return {
    id,
    clubName: text(course?.club_name) || text(course?.course_name) || 'Unnamed club',
    courseName: text(course?.course_name),
    location: locationLabel(course?.location),
    tees: toTees(course),
  }
}

function teeAt(course: any, teeId: string): any {
  const [gender, index] = teeId.split(':')
  const list = course?.tees?.[gender]
  return Array.isArray(list) ? list[Number(index)] : null
}

/**
 * Stroke indexes decide where shots are given, so they matter more than par.
 *
 * Only the ordering is checked, not the numbers themselves: strokesOnHole ranks
 * the holes actually being played, so a nine-hole card carrying its half of an
 * eighteen — 1, 3, 5 … 17 — allocates shots exactly like 1 … 9 would. Rejecting
 * those would throw away real data and replace it with a guess.
 *
 * What cannot be used is a card with no ordering in it at all: every value
 * missing or zero, or the same rank given to two holes.
 */
function strokeIndexesFrom(holes: any[]): number[] | null {
  const raw = holes.map((h) => Number(h?.handicap))
  if (raw.some((v) => !Number.isInteger(v) || v < 1)) return null
  if (new Set(raw).size !== holes.length) return null
  return raw
}

export interface BuiltCourse {
  course: Course
  warnings: string[]
}

/**
 * The chosen tee of the chosen course, as a card the round can be played off.
 */
export function buildCourse(payload: any, teeId: string): BuiltCourse | null {
  const raw = payload?.course ?? payload
  const external = toExternalCourse(payload)
  if (!external) return null

  const tee = teeAt(raw, teeId) ?? teeAt(raw, external.tees[0]?.id ?? '')
  const teeMeta = external.tees.find((t) => t.id === teeId) ?? external.tees[0] ?? null
  const apiHoles = Array.isArray(tee?.holes) ? tee.holes : []
  const warnings: string[] = []

  let holes: Hole[]
  if (apiHoles.length) {
    const indexes = strokeIndexesFrom(apiHoles)
    if (!indexes) {
      warnings.push('This card has no usable stroke indexes, so a standard set was used.')
    }
    const fallback = defaultHoles()
    holes = apiHoles.map((h: any, i: number) => ({
      number: i + 1,
      par: num(h?.par) ?? 4,
      strokeIndex: indexes ? indexes[i] : (fallback[i]?.strokeIndex ?? i + 1),
      yards: num(h?.yardage) ?? undefined,
    }))
  } else {
    warnings.push('This tee has no hole-by-hole card, so a standard par-72 was used.')
    holes = defaultHoles()
  }

  if (!teeMeta?.slopeRating) {
    warnings.push('No slope rating on this tee — handicaps are calculated off the standard 113.')
  }
  if (!teeMeta?.courseRating) {
    warnings.push('No course rating on this tee, so par stands in for it.')
  }

  // Many clubs file the course under its own name again. "Pebble Beach Golf
  // Links · Pebble Beach Golf Links" helps nobody.
  const sameName =
    external.courseName.toLowerCase().trim() === external.clubName.toLowerCase().trim()
  const name =
    external.courseName && !sameName
      ? `${external.clubName} · ${external.courseName}`
      : external.clubName

  return {
    course: {
      id: `gca:${external.id}:${teeMeta?.id ?? 'default'}`,
      name,
      holes,
      courseRating: teeMeta?.courseRating ?? undefined,
      slopeRating: teeMeta?.slopeRating ?? 113,
      externalId: external.id,
      teeName: teeMeta?.name ?? null,
    },
    warnings,
  }
}
