import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { formatPct, formatPoints } from '../calc/format'
import { clamp } from '../calc/numbers'
import { FounderPhrase } from '../copy/people'
import type { HolderKind, ModelResults, SafeResults } from '../calc/types'
import { COLORS, holderColor } from './palette'
import { Num } from './primitives'

/* ==========================================================================
   Before / after ownership. The one picture in the memo that has to teach
   dilution without being read: founders keep their individual slices so a
   60/40 split is visible, investors collapse into one block because the cap
   table below already itemises them.
   ========================================================================== */

/** Left gutter for the row label, wide enough for "AFTER ROUND" over two lines. */
const GUTTER = 62

/** Below this a percentage inside a segment is unreadable, so it moves to the legend. */
const LABEL_MIN_PX = 56

/**
 * 11px, under every .t-* role on purpose: the bar's own lettering and its key are
 * annotation on a picture, and must not compete with the cap table beside them.
 */
const FINE = 11

/**
 * Spelled out because this is the memo's voice, and "The 2 of you" would put a
 * numeral where a word belongs. Past six cofounders the address stops working.
 */
interface Seg {
  id: string
  name: string
  kind: HolderKind
  color: string
  before: number
  after: number
  /** Points gained or lost. Read off the cap table, never subtracted here. */
  change: number
}

type Part = string | { num: string }

export function OwnershipBar({ results }: { results: ModelResults }) {
  const { safe, gates } = results
  const computable = gates.ownershipComputable
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)

  // Inline labels are gated on real pixels, not a guessed percentage: at 400px a
  // 14% slice is too narrow to letter, at 900px it is comfortable. `computable`
  // is a dependency only because the track unmounts while the gate is closed.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    setTrackWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setTrackWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [computable])

  if (!computable) {
    // Blockers are named in the same order the cap table's banner picks its own, so
    // the two never disagree about which input broke first. An empty founder list
    // also closes the split gate, and blaming the split for it reads as nonsense.
    const reason: Part[] = gates.safeOversold
      ? ['the SAFEs as entered already sell the whole company']
      : gates.hasInvalidCap
        ? ['an investor has no valuation cap to work from']
        : safe.founderRows.length === 0
          ? ['there is nobody on the founder list yet']
          : ['the founder split does not add up to ', { num: '100%' }]
    const note: Part[] = ['Ownership cannot be drawn while ', ...reason, '.']
    return (
      <div role="img" aria-label={flatten(note)}>
        <div style={{ display: 'grid', rowGap: 10 }}>
          {/* An .own-bar with no children is already the ink-100 empty track. */}
          <BarRow label="Before" segs={[]} phase="before" trackWidth={0} />
          <BarRow label="After round" segs={[]} phase="after" trackWidth={0} />
        </div>
        <Prose parts={note} className="t-caption" style={{ marginTop: 10, paddingLeft: GUTTER }} />
      </div>
    )
  }

  const changeById = new Map(safe.capTable.map((row) => [row.id, row.change]))
  const segs: Seg[] = [
    ...safe.founderRows.map((row, i) => ({
      id: row.id,
      name: row.name.trim() || `Founder ${i + 1}`,
      kind: 'founder' as const,
      color: holderColor('founder', i),
      before: row.before,
      after: row.after,
      change: changeById.get(row.id) ?? 0,
    })),
    {
      id: 'investors',
      name: 'Investors',
      kind: 'investor' as const,
      color: COLORS.investors,
      before: safe.before.investors,
      after: safe.after.investors,
      // Nobody holds investor stock before the round, so the after *is* the change.
      change: safe.totalSafeOwnership,
    },
    {
      id: 'option-pool',
      name: 'Option pool',
      kind: 'pool' as const,
      color: COLORS.pool,
      before: safe.before.pool,
      after: safe.after.pool,
      change: safe.capTable.find((row) => row.kind === 'pool')?.change ?? 0,
    },
  ]

  const parts = sentenceParts(safe)
  const legend = segs.filter((seg) => seg.kind === 'founder' || seg.after > 0)
  // role="img" hides everything inside it from a screen reader, legend included, so
  // the label has to carry the split as well as the sentence or the numbers vanish.
  const spoken = `${flatten(parts)} After the round: ${legend
    .map((seg) => `${seg.name} ${formatPct(seg.after, 1)}`)
    .join(', ')}.`

  return (
    <div role="img" aria-label={spoken}>
      <BarRow
        label="Before"
        segs={segs}
        phase="before"
        trackWidth={trackWidth}
        trackRef={trackRef}
      />

      {/* 12.5/19 is the reading voice between the bars — one step under .t-td and
          one over .t-caption, neither of which index.css offers at this size. */}
      <Prose
        parts={parts}
        strong
        className="text-ink-600"
        style={{
          fontSize: 12.5,
          lineHeight: '19px',
          marginTop: 10,
          marginBottom: 10,
          paddingLeft: GUTTER,
          maxWidth: '64ch',
        }}
      />

      <BarRow label="After round" segs={segs} phase="after" trackWidth={trackWidth} />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 18,
          marginTop: 10,
          paddingLeft: GUTTER,
        }}
      >
        {legend.map((seg) => (
          <span key={seg.id} className="inline-flex items-center">
            <span className="key-square" style={{ background: seg.color, marginRight: 8 }} />
            <span className="text-ink-600" style={{ fontSize: FINE, fontWeight: 500 }}>
              {seg.name}
            </span>
            <span className="num text-ink-900" style={{ fontSize: FINE, marginLeft: 6 }}>
              {formatPct(seg.after, 1)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function BarRow({
  label,
  segs,
  phase,
  trackWidth,
  trackRef,
}: {
  label: string
  segs: Seg[]
  phase: 'before' | 'after'
  trackWidth: number
  trackRef?: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${GUTTER}px minmax(0, 1fr)`,
        alignItems: 'center',
      }}
    >
      <span className="t-th" style={{ paddingRight: 10 }}>
        {label}
      </span>
      <div className="own-bar" ref={trackRef}>
        {segs.map((seg) => {
          // A holder with nothing gets no segment at all — min-width would draw
          // them a 2px sliver and imply an ownership they do not have.
          const share = clamp(seg[phase], 0, 1)
          if (share <= 0) return null
          return (
            <div
              key={seg.id}
              className="own-seg"
              style={{ flexBasis: `${share * 100}%`, background: seg.color }}
              title={`${seg.name} · before ${formatPct(seg.before, 1)} · after ${formatPct(
                seg.after,
                1,
              )} · ${formatPoints(seg.change)}`}
            >
              {share * trackWidth >= LABEL_MIN_PX && (
                <span
                  className="num"
                  style={{
                    fontSize: FINE,
                    lineHeight: '28px',
                    fontWeight: 500,
                    paddingLeft: 8,
                    ...labelInk(seg.kind),
                  }}
                >
                  {formatPct(share, 1)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One line of prose whose live numbers stay tabular. Built from parts so the same
 * content can be flattened into an aria-label without the markup coming along.
 */
function Prose({
  parts,
  className,
  style,
  strong = false,
}: {
  parts: Part[]
  className?: string
  style?: CSSProperties
  strong?: boolean
}) {
  return (
    <p className={className} style={style}>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <Num key={i} className={strong ? 'font-semibold' : ''}>
            {part.num}
          </Num>
        ),
      )}
    </p>
  )
}

function flatten(parts: Part[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.num)).join('')
}

/** White on the pool grey is 2.85:1, so the pool letters its share in ink — at full
 * strength, because 0.78 opacity drops it back to the floor. */
function labelInk(kind: HolderKind) {
  return kind === 'pool'
    ? { color: 'var(--color-ink-900)' }
    : { color: 'rgba(255, 255, 255, 0.94)' }
}

/**
 * The move in words. Split into parts so the same content serves the sentence
 * and the aria-label, with the live numbers set at 600 in the visible one.
 */
function sentenceParts(safe: SafeResults): Part[] {
  const who = FounderPhrase(safe.founderRows.length)
  const hasSafes = safe.totalSafeOwnership > 0
  // A pool that exists but does not grow is still worth naming once the round is
  // real — "0 points to the option pool" is the answer to an obvious question.
  const showPool = safe.dilutionPointsFromPool > 0 || (hasSafes && safe.poolPreSafePct > 0)

  if (!hasSafes && !showPool) {
    return [
      `${who} hold `,
      { num: formatPct(safe.before.founders, 1) },
      ' of the company. Nothing in this round moves it yet.',
    ]
  }

  const parts: Part[] = [
    `${who} go from `,
    { num: formatPct(safe.before.founders, 1) },
    ' to ',
    { num: formatPct(safe.after.founders, 1) },
    ', giving ',
  ]
  const moves: Part[][] = []
  // Recipient-framed, so the sentence and the cap table under it print the same
  // points: S + (pool after − pool today) is exactly the founders' total loss.
  if (hasSafes) moves.push(move(safe.totalSafeOwnership, 'investors'))
  if (showPool) moves.push(move(safe.after.pool - safe.before.pool, 'the option pool'))
  moves.forEach((clause, i) => {
    if (i > 0) parts.push(' and ')
    parts.push(...clause)
  })
  parts.push('.')
  return parts
}

/**
 * One clause of the move. In prose the direction is already in the words ("to
 * investors"), so the sign formatPoints prints would read as a stutter, and "pts"
 * is a table abbreviation a sentence should spell out — with the singular, because
 * exactly one point is a real answer. The rounding still comes from formatPoints,
 * which is what keeps this sentence and the cap table agreeing.
 */
/**
 * These are the founders' OWN points, which is not the same as what the other side
 * gains: a 10-point pool created before the SAFEs convert lands at 8.75 points on
 * the cap table. The wording says "of your points" so the sentence and the table
 * below it cannot be read as contradicting each other.
 */
function move(delta: number, destination: string): Part[] {
  const magnitude = formatPoints(delta).replace(/^[+−]/, '').replace(' pts', '')
  return [{ num: magnitude }, `${magnitude === '1' ? ' point' : ' points'} to ${destination}`]
}
