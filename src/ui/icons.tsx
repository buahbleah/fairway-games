/**
 * ICON SYSTEM
 * One family, one grid (24), one weight (1.75), round caps and joins.
 * Drawn here rather than pulled from a library so the golf marks and the
 * interface marks share a single hand — and so the app stays offline.
 */

interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
  title?: string
}

function base({ size = 24, className, strokeWidth = 1.75, title }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    role: title ? ('img' as const) : ('presentation' as const),
    'aria-label': title,
    'aria-hidden': title ? undefined : true,
  }
}

/* --------------------------------------------------------- interface icons */

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 9l7 7 7-7" />
  </svg>
)

export const Plus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Minus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
)

export const Check = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12.5l5.2 5.2L20 7" />
  </svg>
)

export const Close = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const Info = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none" />
  </svg>
)

export const Undo = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 9h9.5A5.5 5.5 0 0 1 19 14.5v0A5.5 5.5 0 0 1 13.5 20H8" />
    <path d="M7.5 5.5L4 9l3.5 3.5" />
  </svg>
)

export const Edit = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15.5 5.5l3 3L9 18l-4 1 1-4z" />
    <path d="M14 7l3 3" />
  </svg>
)

export const Settings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
  </svg>
)

export const History = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.6 10.4A8.5 8.5 0 1 1 4 15" />
    <path d="M3.2 5.5v5h5" />
    <path d="M12 8v4.4l3 1.8" />
  </svg>
)

export const Share = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5v11" />
    <path d="M8.2 7.3L12 3.5l3.8 3.8" />
    <path d="M6 12.5v6.2a1.3 1.3 0 0 0 1.3 1.3h9.4a1.3 1.3 0 0 0 1.3-1.3v-6.2" />
  </svg>
)

export const Sun = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.6v2M12 19.4v2M21.4 12h-2M4.6 12h-2M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4M18.6 18.6l-1.4-1.4M6.8 6.8L5.4 5.4" />
  </svg>
)

export const Moon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />
  </svg>
)

export const Trash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 6.5h15M9.5 6.5V4.8h5v1.7" />
    <path d="M6.5 6.5l.9 12.2a1.3 1.3 0 0 0 1.3 1.2h6.6a1.3 1.3 0 0 0 1.3-1.2l.9-12.2" />
  </svg>
)

export const Play = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4.8l12 7.2-12 7.2z" />
  </svg>
)

/* ------------------------------------------------------------- golf icons */

/** Flagstick in a cup — the app's core mark. */
export const Flag = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8.5 20V3.6" />
    <path d="M8.5 4.2l8.4 2.9-8.4 3z" />
    <path d="M4.6 20h8" />
  </svg>
)

export const Ball = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="9.4" cy="10" r=".7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8.2" r=".7" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="10" r=".7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12.4" r=".7" fill="currentColor" stroke="none" />
    <circle cx="9.4" cy="14.6" r=".7" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="14.6" r=".7" fill="currentColor" stroke="none" />
  </svg>
)

export const Course = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 19.2c3.4-1.4 5.2-4.6 5.6-8.2C9 7.4 11 4.6 14.6 4" />
    <path d="M14.6 4v7.2" />
    <path d="M14.6 4.6l4.6 1.6-4.6 1.8z" />
    <ellipse cx="14.6" cy="12" rx="2.2" ry=".9" />
  </svg>
)

export const PlayerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.4" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)

export const Handicap = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5.5 18.5L18.5 5.5" />
    <path d="M5.2 8.4h5M7.7 5.9v5" />
    <path d="M14 15.6h5" />
  </svg>
)

export const Money = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7v10M14.6 9.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2.1 2.8.9 2.8 2.2-1.2 2.1-2.8 2.1c-1.1 0-2.1-.4-2.7-1.3" />
  </svg>
)

export const Trophy = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 5.4H5.2a2.4 2.4 0 0 0 2.4 4.2M16.5 5.4h2.3a2.4 2.4 0 0 1-2.4 4.2" />
    <path d="M12 13v3.6M8.8 20h6.4l-.7-3.4H9.5z" />
  </svg>
)

export const Scorecard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4.2" y="3.6" width="15.6" height="16.8" rx="2.2" />
    <path d="M4.2 9h15.6M9.6 9v11.4" />
    <path d="M12.6 12.4h4.6M12.6 16h4.6" />
  </svg>
)

/* ------------------------------------------------------- per-game marks ---
   Used at 28–40px on cards. Each is a distinct silhouette, not a colour
   variation, so the games remain separable without relying on colour.        */

export const MarkWolf = (p: IconProps) => (
  <svg {...base(p)}>
    {/* Ears are filled triangles rather than stroked corners: with round joins a
        stroked notch softens into a cat. Filled points stay sharp at 20px. */}
    <path d="M3.4 1.8l5.6 6-6.4.8z" fill="currentColor" stroke="none" />
    <path d="M20.6 1.8l-5.6 6 6.4.8z" fill="currentColor" stroke="none" />
    <path d="M3 8.2h18l-.7 4.6c-.6 4.2-3.4 7.3-8.3 8.8-4.9-1.5-7.7-4.6-8.3-8.8z" />
    <path d="M8.4 12.2l2.3 1M15.6 12.2l-2.3 1" />
    <path d="M12 16v2M10.6 15.8h2.8" />
  </svg>
)

export const MarkSkins = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <path d="M12 3.6V1.6M12 22.4v-2M20.4 12h2M1.6 12h2" />
  </svg>
)

export const MarkNassau = (p: IconProps) => (
  <svg {...base(p)}>
    {/* Three connected segments: front, back, overall. The middle one is filled
        so the mark has a focal point instead of reading as a fence. */}
    <rect x="2.4" y="7.6" width="5.8" height="8.8" rx="1.6" />
    <rect x="9.1" y="7.6" width="5.8" height="8.8" rx="1.6" fill="currentColor" stroke="none" />
    <rect x="15.8" y="7.6" width="5.8" height="8.8" rx="1.6" />
  </svg>
)

export const MarkVegas = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.8" y="5.6" width="8" height="12.8" rx="2" />
    <rect x="13.2" y="5.6" width="8" height="12.8" rx="2" />
    <path d="M6 9.4v5.2M8.4 9.4v5.2" />
    <path d="M15.6 12h3.2" />
  </svg>
)

export const MarkDots = (p: IconProps) => (
  <svg {...base(p)}>
    {/* A ball with earned marks collecting above it — asymmetric on purpose, so
        it cannot be mistaken for the Skins target. */}
    <circle cx="10.4" cy="14.6" r="6.2" />
    <circle cx="8.6" cy="13.6" r=".85" fill="currentColor" stroke="none" />
    <circle cx="11.8" cy="12.6" r=".85" fill="currentColor" stroke="none" />
    <circle cx="11.4" cy="16.4" r=".85" fill="currentColor" stroke="none" />
    <circle cx="18.3" cy="5.6" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="20.2" cy="12.1" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="12.6" cy="3.9" r="1.8" fill="currentColor" stroke="none" />
  </svg>
)

export const MarkMatch = (p: IconProps) => (
  <svg {...base(p)}>
    {/* Two flags facing each other with a clear gap between them, so the pair
        does not merge into one shape at small sizes. */}
    <path d="M4.4 21V3.4" />
    <path d="M4.4 4.2l6.4 2.3-6.4 2.5z" fill="currentColor" />
    <path d="M19.6 21V3.4" />
    <path d="M19.6 4.2l-6.4 2.3 6.4 2.5z" fill="currentColor" />
  </svg>
)

export const GAME_MARKS = {
  wolf: MarkWolf,
  skins: MarkSkins,
  nassau: MarkNassau,
  vegas: MarkVegas,
  dots: MarkDots,
  team_match_play: MarkMatch,
} as const
