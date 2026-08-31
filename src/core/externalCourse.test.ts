import { describe, expect, it } from 'vitest'
import { buildCourse, toExternalCourse, toSearchResults, toTees } from './externalCourse'

/**
 * A GolfCourseAPI payload, trimmed to the fields we read. The broken variants
 * below are the ones a public course database actually produces: a tee with no
 * card, stroke indexes left at zero, duplicated indexes, a missing slope.
 */
const payload = {
  course: {
    id: 4711,
    club_name: 'Golfclub Winterthur',
    course_name: 'Championship',
    location: { city: 'Winterthur', state: 'Zürich', country: 'Switzerland' },
    tees: {
      male: [
        {
          tee_name: 'Yellow',
          course_rating: 71.4,
          slope_rating: 132,
          par_total: 72,
          total_yards: 6100,
          number_of_holes: 18,
          holes: Array.from({ length: 18 }, (_, i) => ({
            par: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 5, 4, 4, 3, 4, 5, 4][i],
            yardage: 300 + i,
            handicap: [7, 3, 15, 11, 1, 9, 17, 5, 13, 8, 16, 12, 2, 6, 18, 4, 14, 10][i],
          })),
        },
        { tee_name: 'White', course_rating: 73.1, slope_rating: 137, holes: [] },
      ],
      female: [
        {
          tee_name: 'Red',
          course_rating: 72.8,
          slope_rating: 128,
          holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, handicap: i + 1 })),
        },
      ],
    },
  },
}

describe('Reading a course from the API', () => {
  it('lists what a search found', () => {
    const results = toSearchResults({ courses: [payload.course] })
    expect(results).toEqual([
      {
        id: '4711',
        clubName: 'Golfclub Winterthur',
        courseName: 'Championship',
        location: 'Winterthur, Zürich, Switzerland',
      },
    ])
  })

  it('drops a result with no id, because nothing can be fetched with it', () => {
    expect(toSearchResults({ courses: [{ club_name: 'Ghost' }] })).toEqual([])
  })

  it('offers every tee, both genders', () => {
    const tees = toTees(payload.course)
    expect(tees.map((t) => t.name)).toEqual(['Yellow', 'White', 'Red'])
    expect(tees[0]).toMatchObject({ id: 'male:0', slopeRating: 132, courseRating: 71.4, holeCount: 18 })
    expect(tees[2].gender).toBe('female')
  })

  it('reads the club and the course as one name', () => {
    expect(toExternalCourse(payload)?.clubName).toBe('Golfclub Winterthur')
    expect(buildCourse(payload, 'male:0')!.course.name).toBe('Golfclub Winterthur · Championship')

    // Clubs often file the course under the club's own name again.
    const doubled = {
      course: { ...payload.course, course_name: 'Golfclub Winterthur' },
    }
    expect(buildCourse(doubled, 'male:0')!.course.name).toBe('Golfclub Winterthur')
  })
})

describe('Building the card to play off', () => {
  it('takes par, stroke index and yardage from the chosen tee', () => {
    const { course, warnings } = buildCourse(payload, 'male:0')!
    expect(warnings).toEqual([])
    expect(course.holes).toHaveLength(18)
    expect(course.holes[4]).toMatchObject({ number: 5, par: 4, strokeIndex: 1 })
    expect(course.holes[0].yards).toBe(300)
    expect(course.slopeRating).toBe(132)
    expect(course.courseRating).toBe(71.4)
    expect(course.teeName).toBe('Yellow')
  })

  it('keeps the tee it was asked for, not the first one', () => {
    expect(buildCourse(payload, 'female:0')!.course.teeName).toBe('Red')
    expect(buildCourse(payload, 'female:0')!.course.slopeRating).toBe(128)
  })

  it('falls back to a standard card when the tee has no holes', () => {
    const { course, warnings } = buildCourse(payload, 'male:1')!
    expect(course.holes).toHaveLength(18)
    expect(warnings).toContain('This tee has no hole-by-hole card, so a standard par-72 was used.')
  })

  it('replaces stroke indexes that are all zero', () => {
    const broken = {
      course: {
        ...payload.course,
        tees: { male: [{ tee_name: 'Blue', slope_rating: 120, course_rating: 70, holes: Array.from({ length: 18 }, () => ({ par: 4, handicap: 0 })) }] },
      },
    }
    const { course, warnings } = buildCourse(broken, 'male:0')!
    expect(warnings[0]).toMatch(/no usable stroke indexes/)
    // Every shot has to land somewhere different, or handicaps stop meaning anything.
    expect(new Set(course.holes.map((h) => h.strokeIndex)).size).toBe(18)
  })

  it('replaces stroke indexes that repeat', () => {
    const dup = Array.from({ length: 18 }, (_, i) => ({ par: 4, handicap: i === 17 ? 1 : i + 1 }))
    const broken = { course: { ...payload.course, tees: { male: [{ tee_name: 'Blue', holes: dup }] } } }
    const { course } = buildCourse(broken, 'male:0')!
    expect(new Set(course.holes.map((h) => h.strokeIndex)).size).toBe(18)
  })

  it('keeps a nine-hole card that carries its half of an eighteen', () => {
    // Real nine-hole cards are often indexed 1,3,5..17. strokesOnHole ranks the
    // holes being played, so these allocate shots exactly as 1..9 would.
    const odd = [1, 3, 5, 7, 9, 11, 13, 15, 17]
    const card = {
      course: {
        ...payload.course,
        tees: {
          male: [
            {
              tee_name: 'White',
              slope_rating: 123,
              course_rating: 34.4,
              holes: odd.map((handicap) => ({ par: 4, handicap })),
            },
          ],
        },
      },
    }
    const { course, warnings } = buildCourse(card, 'male:0')!
    expect(warnings).toEqual([])
    expect(course.holes.map((h) => h.strokeIndex)).toEqual(odd)
  })

  it('replaces a card whose stroke indexes are simply absent', () => {
    // Winterberg files pars but leaves every handicap blank.
    const blank = {
      course: {
        ...payload.course,
        tees: { male: [{ tee_name: 'White', slope_rating: 123, course_rating: 34.4,
          holes: Array.from({ length: 9 }, () => ({ par: 4, handicap: '' })) }] },
      },
    }
    const { course, warnings } = buildCourse(blank, 'male:0')!
    expect(warnings[0]).toMatch(/no usable stroke indexes/)
    expect(new Set(course.holes.map((h) => h.strokeIndex)).size).toBe(9)
  })

  it('carries a nine-hole card through as nine holes', () => {
    const nine = {
      course: {
        ...payload.course,
        tees: {
          male: [
            {
              tee_name: 'Yellow',
              slope_rating: 118,
              course_rating: 35.2,
              holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, handicap: i + 1 })),
            },
          ],
        },
      },
    }
    expect(buildCourse(nine, 'male:0')!.course.holes).toHaveLength(9)
  })

  it('stands the slope up at 113 when the tee has none, and says so', () => {
    const noSlope = {
      course: { ...payload.course, tees: { male: [{ tee_name: 'Blue', holes: [] }] } },
    }
    const { course, warnings } = buildCourse(noSlope, 'male:0')!
    expect(course.slopeRating).toBe(113)
    expect(warnings.some((w) => w.includes('113'))).toBe(true)
  })

  it('returns nothing for a payload with no course in it', () => {
    expect(buildCourse({}, 'male:0')).toBeNull()
    expect(toExternalCourse(null)).toBeNull()
  })
})
