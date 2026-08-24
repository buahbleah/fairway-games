/**
 * Dot definitions. Kept in their own file because the Dot Builder UI, the
 * scoring engine and the tests all need them — and because each dot is written
 * so it could later be lifted out as a stand-alone side game.
 */

export type AutoRule = 'birdie' | 'eagle' | 'albatross' | 'holeInOne' | 'doubleBogey' | null

export interface DotDef {
  id: string
  name: string
  emoji: string
  points: number
  /** Detected from the score alone — the golfer never taps these. */
  auto: AutoRule
  enabled: boolean
  /** What earns it. Always written out, because no two groups agree. */
  description: string
  custom?: boolean
}

export const DEFAULT_DOTS: DotDef[] = [
  {
    id: 'birdie',
    name: 'Birdie',
    emoji: '🐦',
    points: 1,
    auto: 'birdie',
    enabled: true,
    description: 'One under par on the hole. Counted automatically from the score.',
  },
  {
    id: 'eagle',
    name: 'Eagle',
    emoji: '🦅',
    points: 2,
    auto: 'eagle',
    enabled: true,
    description: 'Two under par. Counted automatically, and replaces the birdie dot.',
  },
  {
    id: 'greenie',
    name: 'Greenie',
    emoji: '🎯',
    points: 1,
    auto: null,
    enabled: true,
    description: 'Closest to the pin on a par 3, having hit the green with the tee shot.',
  },
  {
    id: 'sandy',
    name: 'Sandy',
    emoji: '🏖',
    points: 1,
    auto: null,
    enabled: true,
    description: 'Up and down out of a bunker.',
  },
  {
    id: 'chipin',
    name: 'Chip-In',
    emoji: '⛳',
    points: 1,
    auto: null,
    enabled: true,
    description: 'Holed from off the green.',
  },
  {
    id: 'snake',
    name: 'Snake',
    emoji: '🐍',
    points: -1,
    auto: null,
    enabled: true,
    description: 'Three-putt. The one dot nobody wants.',
  },
  {
    id: 'longputt',
    name: 'Long Putt',
    emoji: '📏',
    points: 1,
    auto: null,
    enabled: false,
    description: 'A putt holed from outside the agreed distance — usually about 10 metres.',
  },
  {
    id: 'poley',
    name: 'Poley',
    emoji: '🚩',
    points: 1,
    auto: null,
    enabled: false,
    description:
      'Holing a putt from at least the length of the flagstick — roughly 2 metres. Some groups instead require par or better after hitting the pin.',
  },
  {
    id: 'barkie',
    name: 'Barkie',
    emoji: '🌳',
    points: 1,
    auto: null,
    enabled: false,
    description: 'Hitting a tree during the hole and still making par or better.',
  },
  {
    id: 'arnie',
    name: 'Arnie',
    emoji: '🏌',
    points: 1,
    auto: null,
    enabled: false,
    description:
      'Making par or better without ever being on the fairway — named after Arnold Palmer’s scrambling.',
  },
  {
    id: 'disaster',
    name: 'Disaster',
    emoji: '💥',
    points: -1,
    auto: 'doubleBogey',
    enabled: false,
    description: 'Double bogey or worse. Counted automatically.',
  },
]

export function parseDots(raw: string | undefined): DotDef[] {
  if (!raw) return DEFAULT_DOTS.map((d) => ({ ...d }))
  try {
    const parsed = JSON.parse(raw) as DotDef[]
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_DOTS.map((d) => ({ ...d }))
    return parsed
  } catch {
    return DEFAULT_DOTS.map((d) => ({ ...d }))
  }
}

export function serializeDots(dots: DotDef[]): string {
  return JSON.stringify(dots)
}

export function activeDots(raw: string | undefined): DotDef[] {
  return parseDots(raw).filter((d) => d.enabled)
}
