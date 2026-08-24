import type { Course, Hole } from './types'

/**
 * A neutral par-72 card. Stroke indexes follow the usual convention:
 * odd indexes on the front nine, even on the back, hardest holes spread out.
 * Everything is editable in Round Setup — nobody is forced to type a card in.
 */
const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 5, 4, 4, 3, 4, 5, 4]
const DEFAULT_SI = [7, 3, 15, 11, 1, 9, 17, 5, 13, 8, 16, 12, 2, 6, 18, 4, 14, 10]

export function defaultHoles(): Hole[] {
  return DEFAULT_PARS.map((par, i) => ({ number: i + 1, par, strokeIndex: DEFAULT_SI[i] }))
}

export function defaultCourse(name = 'My Course'): Course {
  return { id: 'default', name, holes: defaultHoles(), slopeRating: 113 }
}

export type HoleSet = 'full18' | 'front9' | 'back9'

export function holeSetLabel(set: HoleSet): string {
  return set === 'full18' ? '18 Holes' : set === 'front9' ? 'Front 9' : 'Back 9'
}

export function applyHoleSet(course: Course, set: HoleSet): Course {
  if (set === 'full18') return course
  const holes = set === 'front9' ? course.holes.slice(0, 9) : course.holes.slice(9, 18)
  return { ...course, holes }
}

export function holeByNumber(course: Course, n: number): Hole {
  return course.holes.find((h) => h.number === n) ?? { number: n, par: 4, strokeIndex: n }
}

export function firstHoleNumber(course: Course): number {
  return course.holes[0]?.number ?? 1
}

export function lastHoleNumber(course: Course): number {
  return course.holes[course.holes.length - 1]?.number ?? 18
}

/** "Birdie", "Par", "+2" — used by dots detection and the score chips. */
export function scoreName(strokes: number, par: number): string {
  const d = strokes - par
  if (strokes === 1) return 'Hole in One'
  if (d <= -3) return 'Albatross'
  if (d === -2) return 'Eagle'
  if (d === -1) return 'Birdie'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  if (d === 2) return 'Double Bogey'
  return `+${d}`
}

export function toParLabel(diff: number): string {
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}
