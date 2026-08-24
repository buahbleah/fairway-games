import { describe, expect, it } from 'vitest'
import { courseHandicap, playingHandicaps, strokesOnHole } from './handicap'
import { applyHoleSet, defaultCourse } from './course'
import type { Player } from './types'

const course = defaultCourse()
const player = (handicapIndex: number | null, id = 'p1'): Player => ({
  id,
  name: id,
  handicapIndex,
  colorIndex: 0,
})

describe('Course Handicap', () => {
  it('is the index itself on a course of standard slope and rating', () => {
    expect(courseHandicap(player(11.4), course)).toBe(11)
    expect(courseHandicap(player(18.2), course)).toBe(18)
  })

  it('applies slope and rating', () => {
    const hard = { ...course, slopeRating: 140, courseRating: 74 }
    // 11.4 x (140/113) + (74 - 72) = 14.12 + 2 = 16.1 -> 16
    expect(courseHandicap(player(11.4), hard)).toBe(16)
  })

  it('halves the allocation over nine holes', () => {
    const front = applyHoleSet(course, 'front9')
    expect(courseHandicap(player(18), front)).toBe(9)
  })

  it('gives a player with no index a scratch handicap', () => {
    expect(courseHandicap(player(null), course)).toBe(0)
  })
})

describe('Playing handicaps', () => {
  const four = [player(24, 'a'), player(18, 'b'), player(11, 'c'), player(6, 'd')]

  it('are all zero when handicaps are off', () => {
    const h = playingHandicaps(four, course, { enabled: false, allowancePct: 100, mode: 'difference' })
    expect(Object.values(h)).toEqual([0, 0, 0, 0])
  })

  it('drop everyone by the low player in difference mode', () => {
    const h = playingHandicaps(four, course, { enabled: true, allowancePct: 100, mode: 'difference' })
    expect(h.a).toBe(18)
    expect(h.b).toBe(12)
    expect(h.c).toBe(5)
    expect(h.d).toBe(0)
  })

  it('give the full allocation in full mode', () => {
    const h = playingHandicaps(four, course, { enabled: true, allowancePct: 100, mode: 'full' })
    expect(h.a).toBe(24)
    expect(h.d).toBe(6)
  })

  it('apply the Four-Ball 90% allowance before the difference', () => {
    const h = playingHandicaps(four, course, { enabled: true, allowancePct: 90, mode: 'difference' })
    // 22, 16, 10, 5 after 90% -> minus the low 5
    expect(h.a).toBe(17)
    expect(h.d).toBe(0)
  })
})

describe('Strokes on a hole', () => {
  const holes = course.holes
  const si = (n: number) => holes.find((h) => h.strokeIndex === n)!

  it('gives no shots off scratch', () => {
    expect(strokesOnHole(0, si(1), holes)).toBe(0)
  })

  it('gives one shot on the hardest holes first', () => {
    expect(strokesOnHole(3, si(1), holes)).toBe(1)
    expect(strokesOnHole(3, si(3), holes)).toBe(1)
    expect(strokesOnHole(3, si(4), holes)).toBe(0)
  })

  it('gives a shot on every hole at 18', () => {
    expect(holes.every((h) => strokesOnHole(18, h, holes) === 1)).toBe(true)
  })

  it('gives two shots on the hardest holes above 18', () => {
    expect(strokesOnHole(22, si(1), holes)).toBe(2)
    expect(strokesOnHole(22, si(4), holes)).toBe(2)
    expect(strokesOnHole(22, si(5), holes)).toBe(1)
  })

  it('takes shots back from a plus handicap, starting with the easiest hole', () => {
    expect(strokesOnHole(-1, si(18), holes)).toBe(-1)
    expect(strokesOnHole(-1, si(1), holes)).toBe(0)
  })

  it('allocates across nine holes when only nine are played', () => {
    const front = applyHoleSet(course, 'front9').holes
    const hardest = [...front].sort((a, b) => a.strokeIndex - b.strokeIndex)[0]
    expect(strokesOnHole(9, hardest, front)).toBe(1)
    expect(front.every((h) => strokesOnHole(9, h, front) === 1)).toBe(true)
  })
})
