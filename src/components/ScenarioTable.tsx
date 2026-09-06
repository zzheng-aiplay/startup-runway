import { useId, type ReactNode } from 'react'
import {
  formatMoney,
  formatMoneyCompact,
  formatMonths,
  formatMonthsShort,
  formatPct,
  formatPoints,
} from '../calc/format'
import { DISPLAY_CAP } from '../calc/runway'
import type { ScenarioId, ScenarioSummary } from '../calc/types'
import { Num } from './primitives'

/* ==========================================================================
   Lean / Base / Aggressive, side by side — the decision this whole memo is
   building toward. The chosen plan is a tinted vertical band, not a card, and
   the columns carry no badges: the numbers are the argument.
   ========================================================================== */

/** Figures sit in from each scenario column's edges so the tint never touches a digit. */
const CELL_PAD = 12

/** Below which a runway or ownership gap is rounding, not a difference. */
const RUNWAY_EPS = 0.05
const OWN_EPS = 0.0005

/**
 * An impossible round has no ownership to report — that is "can't be worked out",
 * not "−45%" or "125%". The clamp also keeps float dust from printing as `-0%`.
 */
function ownPct(value: number, computable = true): string {
  if (!computable || value < -OWN_EPS) return '—'
  return formatPct(Math.max(0, value), 1)
}

interface MetricRow {
  label: string
  /**
   * Some cells carry a second line, because the honest label differs per column:
   * each scenario targets its own month, so the month goes in the cell.
   */
  read: (s: ScenarioSummary) => { value: string; sub?: string; alarm?: boolean }
  /** The punchline row: rules above it, weight on it. */
  emphasis?: boolean
}

const METRICS: MetricRow[] = [
  { label: 'Monthly burn (month 1)', read: (s) => ({ value: formatMoney(s.currentMonthlyBurn) }) },
  {
    label: 'Burn at the end of the target',
    read: (s) => ({
      value: formatMoney(s.burnAtEndOfRunway),
      sub: `month ${s.targetRunwayMonths}`,
    }),
  },
  {
    // headcountAtEnd counts non-founder headcount, so a founders-only plan reads 0.
    // Calling the row "hires" says that without a footnote.
    label: 'Hires at the end of the target',
    read: (s) => ({ value: String(s.headcountAtEnd), sub: `month ${s.targetRunwayMonths}` }),
  },
  { label: 'Cash needed', read: (s) => ({ value: formatMoney(s.cashNeeded) }) },
  // The raise and cap rows are the widest in the table; compact keeps them off two lines.
  { label: 'Recommended raise', read: (s) => ({ value: formatMoneyCompact(s.recommendedRaise) }) },
  { label: 'Planned raise', read: (s) => ({ value: formatMoneyCompact(s.plannedRaise) }) },
  {
    label: 'Runway at planned raise',
    read: (s) => ({
      value: formatMonthsShort(s.runwayMonths),
      sub: s.hitsTargetRunway ? undefined : `short of its ${s.targetRunwayMonths} mo target`,
      alarm: !s.hitsTargetRunway,
    }),
  },
  {
    // With no investors the engine falls back to the scenario's headline cap. If that
    // is unset too there is no cap to print, and `$0` would read as a real one.
    label: 'SAFE cap',
    read: (s) => ({
      value: s.ownershipComputable && s.blendedCap > 0 ? formatMoneyCompact(s.blendedCap) : '—',
    }),
  },
  // "Dilution" means exactly one thing on this page — what the founders lose. What
  // the investors gain is a different number as soon as there is an option pool, so
  // it gets its own honest label.
  {
    label: "Investors' share",
    read: (s) => ({ value: ownPct(s.totalSafeOwnership, s.ownershipComputable) }),
  },
  {
    label: 'New option pool',
    read: (s) => ({
      value:
        s.ownershipComputable && s.poolIncrementPoints > 0
          ? formatPoints(-s.poolIncrementPoints)
          : '—',
      sub:
        s.ownershipComputable && s.poolAfterPct > 0
          ? `${formatPct(s.poolAfterPct, 1)} after`
          : undefined,
    }),
  },
  {
    label: 'Founder dilution',
    read: (s) => ({ value: ownPct(s.founderDilution, s.ownershipComputable) }),
  },
  {
    label: 'Founders keep',
    read: (s) => ({ value: ownPct(s.founderBlockAfter, s.ownershipComputable) }),
    emphasis: true,
  },
]

export function ScenarioTable({
  rows,
  activeId,
  onSelect,
}: {
  rows: ScenarioSummary[]
  activeId: ScenarioId
  onSelect: (id: ScenarioId) => void
}) {
  const titleId = useId()
  if (rows.length === 0) return null
  const scenarioCol = `${66 / rows.length}%`

  return (
    <div>
      {/* 13px/600, 11px and 12.5px are deliberate one-offs: this block wants a
          title quieter than .t-group, column blurbs quieter than .t-caption,
          and a closing verdict between .t-caption and .t-body. */}
      <h3
        id={titleId}
        className="text-ink-800"
        style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, margin: 0 }}
      >
        If we plan differently
      </h3>
      <p className="t-caption mt-1 mb-5 max-w-[68ch]">
        All three share the same founders, salaries, payroll load, operating costs and cash in the bank. Only the
        hiring plan, the runway target and its buffer, the raise, the SAFE terms and the option pool
        change.
      </p>

      <div className="max-[899px]:overflow-x-auto">
        <table className="memo-table max-[899px]:min-w-[560px]" aria-labelledby={titleId}>
          <colgroup>
            <col style={{ width: '34%' }} />
            {rows.map((row) => (
              <col key={row.id} style={{ width: scenarioCol }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" style={{ verticalAlign: 'bottom' }}>
                <span className="sr-only">Metric</span>
              </th>
              {rows.map((row) => {
                const active = row.id === activeId
                return (
                  <th
                    key={row.id}
                    scope="col"
                    // Bottom-aligned so a two-line blurb never lifts one column's
                    // underline off the rule the others sit on.
                    style={{ paddingBottom: 0, verticalAlign: 'bottom' }}
                  >
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(row.id)}
                      className={`block w-full cursor-pointer bg-transparent pb-2 text-right border-b-2 -mb-px ${
                        active ? 'border-b-accent' : 'border-b-transparent hover:border-b-ink-300'
                      }`}
                      style={{ paddingLeft: CELL_PAD, paddingRight: CELL_PAD }}
                    >
                      <span className={`t-th block ${active ? 'text-accent' : ''}`}>
                        {row.label}
                      </span>
                      <span
                        className="block text-ink-400"
                        style={{
                          fontSize: 11,
                          lineHeight: '15px',
                          marginTop: 3,
                          whiteSpace: 'normal',
                        }}
                      >
                        {row.blurb}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => (
              <tr key={metric.label} data-total={metric.emphasis ? 'true' : undefined}>
                <td
                  className={metric.emphasis ? 't-total' : 't-td text-ink-600'}
                  style={{ verticalAlign: 'top' }}
                >
                  {metric.label}
                </td>
                {rows.map((row) => {
                  const active = row.id === activeId
                  const cell = metric.read(row)
                  return (
                    <td
                      key={row.id}
                      className={active ? undefined : 'cursor-pointer hover:bg-hover'}
                      style={{
                        paddingLeft: CELL_PAD,
                        paddingRight: CELL_PAD,
                        verticalAlign: 'top',
                        background: active ? 'var(--accent-wash)' : undefined,
                      }}
                      onClick={active ? undefined : () => onSelect(row.id)}
                    >
                      <span
                        className={`num block ${metric.emphasis ? 't-total' : 't-td'} ${
                          cell.alarm ? 'text-cash-out' : ''
                        }`}
                      >
                        {cell.value}
                      </span>
                      {cell.sub && (
                        <span
                          className={`num block ${cell.alarm ? 'text-cash-out' : 'text-ink-400'}`}
                          style={{ fontSize: 11, lineHeight: '15px' }}
                        >
                          {cell.sub}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Tradeoff rows={rows} />

      <p className="t-small mt-2 max-w-[72ch]">
        Raising more at the same cap always costs more of the company. This model never assumes a
        bigger round gets you a better cap.
      </p>
    </div>
  )
}

/** A live number inside the verdict sentence. */
function Strong({ children }: { children: ReactNode }) {
  return <Num className="font-semibold text-ink-800">{children}</Num>
}

/**
 * The two extremes, in words. Reads the first and last rows it was handed rather
 * than naming Lean and Aggressive, so it survives a fourth scenario.
 */
function Tradeoff({ rows }: { rows: ScenarioSummary[] }) {
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (!first || !last || first.id === last.id) return null

  // Past the display cap both cells print `120+ mo`, so a numeric gap here would
  // contradict the table it sits under. Unlimited runway fails this test too.
  const runwayComparable = first.runwayMonths < DISPLAY_CAP && last.runwayMonths < DISPLAY_CAP
  // An oversold round leaves no founder ownership to compare.
  // Both columns have to be printable before the sentence can compare them, or it
  // quotes a move for a column that shows a dash.
  const ownComparable =
    first.ownershipComputable &&
    last.ownershipComputable &&
    first.founderBlockAfter >= 0 &&
    last.founderBlockAfter >= 0

  const runwayGap = last.runwayMonths - first.runwayMonths
  const ownGap = last.founderBlockAfter - first.founderBlockAfter

  // Prose gets the long form: "6 months of runway", not "6 mo".
  const runwayClause: ReactNode = !runwayComparable ? null : Math.abs(runwayGap) < RUNWAY_EPS ? (
    <>funds the same runway</>
  ) : (
    <>
      funds <Strong>{formatMonths(Math.abs(runwayGap))}</Strong>{' '}
      {runwayGap > 0 ? 'more' : 'less'} runway
    </>
  )

  const ownClause: ReactNode = !ownComparable ? null : Math.abs(ownGap) < OWN_EPS ? (
    <>leaves what the founders keep unchanged</>
  ) : (
    <>
      moves what the founders keep by <Strong>{formatPoints(ownGap)}</Strong>
    </>
  )

  if (!runwayClause && !ownClause) return null

  return (
    <p className="text-ink-600 mt-4 max-w-[72ch]" style={{ fontSize: 12.5, lineHeight: '19px' }}>
      Compared with {first.label}, {last.label} {runwayClause}
      {runwayClause && ownClause ? ' and ' : null}
      {ownClause}.
    </p>
  )
}
