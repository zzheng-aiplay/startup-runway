/**
 * A static mark beside the headline: a jagged line climbing to the top right.
 *
 * Deliberately not plotted from anything. The page has a real chart for real
 * numbers; this is here to make the top of the page pleasant to arrive at, and a
 * live sparkline in a masthead only invites the reader to interpret it.
 */

/** Hand-placed so the ragged run-up lands on the corner rather than drifting there. */
const LINE = '2,54 12,47 20,50 30,38 39,42 48,31 58,33 67,24 77,26 86,15 96,17 104,7 112,9 120,2'

export function HeaderMark() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="124"
      height="58"
      viewBox="0 0 124 58"
      className="mt-6 block"
    >
      <defs>
        <linearGradient id="markFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Baseline, at the same weight as every other rule on the page. */}
      <line x1="0" y1="57" x2="124" y2="57" stroke="var(--color-hairline)" strokeWidth="1" />

      <polygon points={`${LINE} 120,57 2,57`} fill="url(#markFill)" />
      <polyline
        points={LINE}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="120" cy="2" r="2.5" fill="var(--color-accent)" />
    </svg>
  )
}
