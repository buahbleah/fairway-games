/**
 * COURSE GEOMETRY
 * Abstract fairway shapes used behind heroes, empty states and result screens.
 * Everything is currentColor / token driven so it works in both themes, and
 * every piece is decorative (aria-hidden) — never the only carrier of meaning.
 */

/** Brand mark: a golf ball whose dimples form a flag. Works with no text. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="21" fill="var(--green-800)" />
      <circle cx="24" cy="24" r="21" fill="none" stroke="var(--sand-500)" strokeWidth="1.5" opacity=".55" />
      <path d="M20 34.5V13.5" stroke="var(--cream-100)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 14.6l9.6 3.3-9.6 3.4z" fill="var(--sand-500)" />
      <circle cx="30.5" cy="30" r="1.5" fill="var(--cream-100)" opacity=".85" />
      <circle cx="26" cy="33.5" r="1.5" fill="var(--cream-100)" opacity=".6" />
      <circle cx="33.5" cy="25.5" r="1.5" fill="var(--cream-100)" opacity=".45" />
    </svg>
  )
}

/** Soft contour lines — a green read from above. Sits behind hero areas. */
export function ContourBackdrop({ opacity = 0.14 }: { opacity?: number }) {
  return (
    <svg
      className="art-backdrop"
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ opacity }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M-20 168c60-46 118-52 176-24s112 16 168-30" />
        <path d="M-20 190c62-50 124-58 186-28s118 14 174-36" />
        <path d="M-20 146c56-42 108-46 160-22s106 12 160-28" />
        <path d="M-20 124c50-36 96-40 142-18s96 8 148-24" />
        <path d="M-20 104c44-30 84-34 124-14s86 4 134-20" />
      </g>
    </svg>
  )
}

/** A fairway seen from the tee: dogleg, bunkers, green with flag. */
export function FairwayScene({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 200" aria-hidden>
      <path
        d="M96 200c-6-52 4-88 30-108s58-26 74-48"
        fill="none"
        stroke="var(--green-200)"
        strokeWidth="54"
        strokeLinecap="round"
      />
      <path
        d="M96 200c-6-52 4-88 30-108s58-26 74-48"
        fill="none"
        stroke="var(--green-100)"
        strokeWidth="38"
        strokeLinecap="round"
      />
      <ellipse cx="204" cy="40" rx="34" ry="18" fill="var(--green-300)" />
      <ellipse cx="160" cy="86" rx="16" ry="8" fill="var(--sand-300)" />
      <ellipse cx="232" cy="66" rx="13" ry="7" fill="var(--sand-300)" />
      <path d="M206 40V14" stroke="var(--ink-700)" strokeWidth="2" strokeLinecap="round" />
      <path d="M206 15l13 4.4-13 4.6z" fill="var(--clay-500)" />
      <circle cx="196" cy="41" r="3" fill="var(--cream-100)" stroke="var(--ink-300)" strokeWidth=".8" />
    </svg>
  )
}

/** Empty state: a ball resting by the cup on an otherwise empty green. */
export function EmptyGreen({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" aria-hidden>
      <ellipse cx="100" cy="104" rx="82" ry="30" fill="var(--brand-soft)" />
      <ellipse cx="100" cy="104" rx="54" ry="19" fill="none" stroke="var(--brand)" strokeWidth="1" opacity=".35" />
      <ellipse cx="112" cy="100" rx="9" ry="3.6" fill="var(--green-700)" opacity=".8" />
      <path d="M112 100V26" stroke="var(--text-muted)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M112 28l20 6.6-20 7z" fill="var(--accent)" />
      <circle cx="86" cy="103" r="6" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.2" />
      <circle cx="84" cy="101" r="1" fill="var(--text-faint)" />
      <circle cx="88" cy="104" r="1" fill="var(--text-faint)" />
    </svg>
  )
}

/** Winner hero: flag rising out of a green with a low sun behind it. */
export function ResultHero() {
  return (
    <svg className="result-hero__art" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sand-400)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--sand-400)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="160" r="130" fill="url(#dawn)" />
      {/* The flag sits off to the side. Centred, it draws straight through the
          winner's name. */}
      <g className="result-hero__flag" opacity=".5">
        <path d="M330 206V86" stroke="var(--cream-100)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M330 89l28 9.5-28 10z" fill="var(--sand-400)" />
      </g>
      <path d="M0 200c70-26 130-26 200 0s130 26 200 0v40H0z" fill="var(--green-700)" opacity=".55" />
      <path d="M0 214c70-22 130-22 200 0s130 22 200 0v26H0z" fill="var(--green-800)" opacity=".7" />
    </svg>
  )
}

/** Tiny hole-shaped progress dots used by the setup flow. */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="stepdots" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`stepdots__pip${i + 1 === current ? ' is-now' : i + 1 < current ? ' is-done' : ''}`} />
      ))}
    </div>
  )
}
