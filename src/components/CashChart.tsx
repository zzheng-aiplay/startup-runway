import { useEffect, useState, type CSSProperties } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatAxisMoney, formatMoney, formatMonths } from '../calc/format'
import { COLORS } from './palette'
import type { ModelResults } from '../calc/types'

/* ==========================================================================
   The cash-balance figure. It hangs on the page under a hairline like a plate
   in a printed memo: no frame, no fill, and none of Recharts' own furniture —
   every axis, grid line, marker, tooltip and legend below is drawn to the
   memo's own scale.
   ========================================================================== */

/**
 * 11px is the chart's chrome size. It sits deliberately below the smallest
 * .t-* role, because axis ticks, legend keys and the tooltip's hire note are
 * apparatus around the numbers rather than text to be read.
 */
const CHROME = 11

/**
 * Reference-line labels: small caps in everything but name. 10px sits under
 * CHROME on purpose — a marker written across the plot has to name an event
 * without being mistaken for one of the axis's own numbers.
 */
const MARKER_LABEL = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.07em',
  className: 'num',
} as const

/** Hire months are tracked a hair tighter: the labels are words, not small caps. */
const HIRE_LABEL = { ...MARKER_LABEL, letterSpacing: '0.06em' } as const

/** Read once — the preference cannot usefully change between two renders. */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hire months past this many go unlabelled; the dashed lines stay. */
const LABELLED_HIRES = 4

// ------------------------------------------------------------- annotation --

interface Clause {
  text: string
  /** Live numbers are set at 600 so the sentence can be skimmed for them. */
  strong?: boolean
  /** The only clause allowed semantic colour: the month the money is gone. */
  alarm?: boolean
}

/**
 * One sentence saying what the two lines mean. Built as clauses rather than a
 * string so the same sentence can be typeset with live numbers picked out and
 * handed to `aria-label` intact.
 */
function annotate(results: ModelResults): Clause[] {
  const { capital, runway } = results
  // Month 0 of the chart *is* the opening balance, already floored at zero the
  // same way the plotted line is — safer to read than the raw input.
  const cash = results.chart[0]?.cashNoRaise ?? 0
  const dryMonth = runway.outOfCashMonthWithoutRaise

  // Nothing in the bank and nothing coming in: there is no line to read.
  if (runway.outOfCashMonthWithRaise === 0) {
    return [
      { text: 'There is ' },
      { text: formatMoney(cash), strong: true },
      { text: ' in the bank and no raise planned, so you are ' },
      { text: 'out of cash today', alarm: true },
      { text: '.' },
    ]
  }

  const dry: Clause[] =
    dryMonth === null || dryMonth > runway.horizon
      ? [{ text: 'the cash still outlasts this chart' }]
      : dryMonth === 0
        ? [{ text: 'the bank is empty today', alarm: true }]
        : [{ text: 'you run dry in ' }, { text: `month ${dryMonth}`, alarm: true }]

  // No raise on the table means one line, and it is today's cash. Saying
  // "with the raise" about it would name money that does not exist.
  if (capital.plannedRaise === 0) {
    if (!Number.isFinite(runway.withoutRaise)) {
      return [{ text: 'No raise planned, and at this burn today’s cash never runs out.' }]
    }
    return [
      { text: 'No raise planned. Today’s cash gives you ' },
      { text: formatMonths(runway.withoutRaise), strong: true },
      { text: ': ' },
      ...dry,
      { text: '.' },
    ]
  }

  // An unbounded runway is a word, not a number, and "unlimited months of cash"
  // is not English — so the unbounded case says it in words instead. The
  // unfunded line can still die here: a small burn on a big raise outlasts the
  // simulation while today's cash does not.
  if (!Number.isFinite(runway.withRaise)) {
    if (!Number.isFinite(runway.withoutRaise)) {
      return [{ text: 'At this burn the money never runs out, raise or no raise.' }]
    }
    return [
      { text: 'With the raise the money never runs out at this burn. Without it, ' },
      ...dry,
      { text: '.' },
    ]
  }

  return [
    { text: 'With the raise you have ' },
    { text: formatMonths(runway.withRaise), strong: true },
    { text: ' of cash. Without it, ' },
    ...dry,
    { text: '.' },
  ]
}

// ------------------------------------------------------------------ parts --

function KeyItem({ mark, label }: { mark: CSSProperties; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" style={{ flex: 'none', ...mark }} />
      <span
        className="text-ink-600"
        style={{ fontSize: CHROME, lineHeight: '16px', fontWeight: 500 }}
      >
        {label}
      </span>
    </li>
  )
}

/** One line of the tooltip. `color` null draws an invisible key, to hold the column. */
function TipRow({
  color,
  label,
  value,
  rule,
}: {
  color: string | null
  label: string
  value: string
  /** A total sits under a hairline, the same way the memo's tables do it. */
  rule?: boolean
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4"
      style={
        rule
          ? { marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-hairline)' }
          : undefined
      }
    >
      <span className="t-td text-ink-600">
        <span
          aria-hidden="true"
          className="key-square mr-2"
          style={{ background: color ?? 'transparent', verticalAlign: 'middle' }}
        />
        {label}
      </span>
      <span className="t-td num text-ink-900">{value}</span>
    </div>
  )
}

/** Matches the stylesheet's own breakpoint, so the figure shortens with the page. */
function useFigureHeight(): number {
  const [height, setHeight] = useState(() => (window.innerWidth <= 899 ? 220 : 260))
  useEffect(() => {
    const onResize = () => setHeight(window.innerWidth <= 899 ? 220 : 260)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return height
}

// ------------------------------------------------------------------ chart --

export function CashChart({ results }: { results: ModelResults }) {
  const height = useFigureHeight()

  // One reveal on first paint, then off: the chart recalculates on every
  // keystroke, and re-animating it each time would be unreadable.
  const [animate, setAnimate] = useState(!REDUCED_MOTION)
  useEffect(() => {
    const timer = window.setTimeout(() => setAnimate(false), 480)
    return () => window.clearTimeout(timer)
  }, [])

  const { capital, runway, hireEvents } = results
  const hasRaise = capital.plannedRaise > 0
  // With no raise the two series are identical and the counterfactual would
  // render invisibly underneath the funded line; with an empty bank it is a
  // single point at the origin. Either way the sentence below carries it instead
  // of a legend entry promising a line that is not there.
  const showCounterfactual = hasRaise && runway.withoutRaise > 0
  // Month 0 carries the opening balance, so one number settles whether there is
  // anything to draw: no cash and no raise leaves a single zero and no line.
  const hasPlot = (results.chart[0]?.cashWithRaise ?? 0) > 0
  const sentence = annotate(results)
  const label = sentence.map((clause) => clause.text).join('')

  const horizon = runway.horizon
  // Ticks thin out as the window grows so `M108` labels never touch: every
  // month up to a year, then every third, sixth or twelfth.
  const tickStep = horizon <= 12 ? 1 : horizon <= 36 ? 3 : horizon <= 72 ? 6 : 12

  const dryMonth = runway.outOfCashMonthWithoutRaise
  const showDryMarker = dryMonth !== null && dryMonth > 0 && dryMonth <= horizon
  // The engine only fills this series when the plan and the recommendation differ.
  const showRecommended = results.chart.some((row) => row.cashAtRecommended !== null)
  const unlabelledHires = Math.max(0, hireEvents.length - LABELLED_HIRES)

  return (
    <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--color-hairline)' }}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div>
          {/* 13px/600: a figure title, one notch quieter than .t-value and heavier
              than .t-label. Neither role fits, so the exact pixels are set here. */}
          <div
            className="text-ink-800"
            style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600 }}
          >
            Cash balance
          </div>
          <div className="t-caption mt-0.5">
            {showCounterfactual
              ? 'end of month, with and without the raise'
              : hasRaise
                ? 'end of month, once the raise lands'
                : 'end of month, on the cash you have today'}
          </div>
        </div>

        {/* Hand-built: Recharts' own <Legend> brings its own type scale and swatches. */}
        <ul className="flex items-center gap-4" hidden={!hasPlot}>
          <KeyItem
            mark={{ width: 14, height: 1.75, background: COLORS.accent }}
            label={hasRaise ? 'With raise' : 'Cash in the bank'}
          />
          {showCounterfactual && (
            <KeyItem
              mark={{
                width: 14,
                height: 1.25,
                background: `repeating-linear-gradient(to right, ${COLORS.cashOut} 0 3px, transparent 3px 6px)`,
              }}
              label="Without raise"
            />
          )}
          {showRecommended && (
            <KeyItem
              mark={{
                width: 14,
                height: 1.25,
                background: `repeating-linear-gradient(to right, ${COLORS.accent} 0 1.5px, transparent 1.5px 4px)`,
              }}
              label="At the recommended raise"
            />
          )}
          {hireEvents.length > 0 && (
            <KeyItem
              mark={{
                width: 1,
                height: 10,
                background:
                  'repeating-linear-gradient(to bottom, var(--color-ink-400) 0 2px, transparent 2px 4px)',
              }}
              label="Hire"
            />
          )}
        </ul>
      </header>

      <figure role="img" aria-label={label} className="m-0 mt-3">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={results.chart}
            margin={{ top: 16, right: 16, bottom: 0, left: 0 }}
            /* The figure already carries its own label and the table below carries
               the data, so Recharts' keyboard layer would only put a focusable
               role="application" node inside a role="img". */
            accessibilityLayer={false}
          >
            <defs>
              <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.1} />
                <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Horizontal hairlines only: with no vertical grid, the hire lines
                read as events instead of chrome. */}
            <CartesianGrid vertical={false} stroke={COLORS.ink100} strokeWidth={1} />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: COLORS.rule, strokeWidth: 1 }}
              tick={{ fill: COLORS.ink500, fontSize: CHROME, dy: 8, className: 'num' }}
              tickFormatter={(month: number) => `M${month}`}
              interval={tickStep - 1}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tickCount={5}
              tick={{ fill: COLORS.ink500, fontSize: CHROME, className: 'num' }}
              tickFormatter={formatAxisMoney}
              domain={[0, (dataMax: number) => dataMax * 1.08]}
            />

            {/* No zero-cash rule. The engine clamps both series at zero and the Y
                domain starts there, so the X axis already *is* the zero line —
                drawing a red one over it only alarms the axis and collides with
                the month ticks. */}
            {capital.bufferAmount > 0 && (
              <ReferenceLine
                y={capital.bufferAmount}
                stroke={COLORS.ink300}
                strokeDasharray="2 4"
                label={{
                  value: 'BUFFER',
                  position: 'insideTopLeft',
                  fill: COLORS.ink500,
                  ...MARKER_LABEL,
                }}
              />
            )}

            {hireEvents.map((event, i) => (
              <ReferenceLine
                key={event.month}
                x={event.month}
                stroke={COLORS.rule}
                strokeDasharray="2 3"
                label={
                  i < LABELLED_HIRES
                    ? {
                        value: event.label,
                        position: 'top',
                        fill: COLORS.ink600,
                        ...HIRE_LABEL,
                      }
                    : false
                }
              />
            ))}

            {/* type="linear" always: a cash balance steps down month by month, and
                smoothing it would invent months that never happened. */}
            <Area
              type="linear"
              dataKey="cashWithRaise"
              stroke={COLORS.accent}
              strokeWidth={1.75}
              fill="url(#cashFill)"
              dot={false}
              connectNulls={false}
              activeDot={{
                r: 3,
                fill: COLORS.paper,
                stroke: COLORS.accent,
                strokeWidth: 1.5,
              }}
              isAnimationActive={animate}
              animationDuration={420}
            />
            {showRecommended && (
              <Line
                type="linear"
                dataKey="cashAtRecommended"
                stroke={COLORS.accent}
                strokeWidth={1}
                strokeDasharray="1.5 2.5"
                strokeOpacity={0.7}
                dot={false}
                activeDot={{
                  r: 2.5,
                  fill: COLORS.paper,
                  stroke: COLORS.accent,
                  strokeWidth: 1.25,
                }}
                isAnimationActive={animate}
                animationDuration={420}
              />
            )}
            {showCounterfactual && (
              <Line
                type="linear"
                dataKey="cashNoRaise"
                stroke={COLORS.cashOut}
                strokeWidth={1.25}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{
                  r: 2.5,
                  fill: COLORS.paper,
                  stroke: COLORS.cashOut,
                  strokeWidth: 1.25,
                }}
                isAnimationActive={animate}
                animationDuration={420}
              />
            )}

            {showDryMarker && (
              <ReferenceDot
                x={dryMonth}
                y={0}
                r={3}
                fill={COLORS.paper}
                stroke={COLORS.cashOut}
                strokeWidth={1.5}
                label={{
                  value: `RUNS DRY M${dryMonth}`,
                  position: 'top',
                  offset: 8,
                  fill: COLORS.cashOut,
                  ...MARKER_LABEL,
                }}
              />
            )}

            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: COLORS.ink300, strokeWidth: 1, strokeDasharray: '2 3' }}
              content={({ active, label: month }) => {
                if (!active) return null
                const row = results.chart.find((point) => point.month === Number(month))
                if (!row) return null
                const hire = hireEvents.find((event) => event.month === row.month)
                return (
                  <div
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-ink-200)',
                      borderRadius: 2,
                      padding: '10px 12px',
                      minWidth: 176,
                    }}
                  >
                    <div className="t-th mb-1.5">
                      MONTH <span className="num">{row.month}</span>
                    </div>
                    <TipRow
                      color={COLORS.accent}
                      label="With raise"
                      value={row.cashWithRaise === null ? '—' : formatMoney(row.cashWithRaise)}
                    />
                    {showRecommended && (
                      <TipRow
                        color={COLORS.accent}
                        label="At the recommended raise"
                        value={
                          row.cashAtRecommended === null
                            ? '—'
                            : formatMoney(row.cashAtRecommended)
                        }
                      />
                    )}
                    {showCounterfactual && (
                      <TipRow
                        color={COLORS.cashOut}
                        label="Without raise"
                        value={row.cashNoRaise === null ? '—' : formatMoney(row.cashNoRaise)}
                      />
                    )}
                    {showCounterfactual && row.cashWithRaise !== null && row.cashNoRaise !== null && (
                      <TipRow
                        rule
                        color={null}
                        label="Difference"
                        /* The gap between the two lines. At month 0 it is the raise. */
                        value={formatMoney(row.cashWithRaise - row.cashNoRaise)}
                      />
                    )}
                    {/* The brief asks the chart to show burn as well as balance, and every
                        row already carries it. */}
                    <TipRow
                      rule={!showCounterfactual}
                      color={null}
                      label="Burn this month"
                      value={formatMoney(row.burn)}
                    />
                    {hire && (
                      <div
                        className="text-ink-600 mt-1.5"
                        style={{ fontSize: CHROME, lineHeight: '16px' }}
                      >
                        +{' '}
                        {hire.roles
                          .map((r) => (r.headcount > 1 ? `${r.role} ×${r.headcount}` : r.role))
                          .join(', ')}{' '}
                        starts
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </figure>

      {/* 12.5/19 is the note size the Banner primitive already uses; no .t-* role
          carries it, so the pixels are set here. */}
      <p
        className="text-ink-600 mt-3"
        style={{ fontSize: 12.5, lineHeight: '19px', maxWidth: '60ch' }}
      >
        {sentence.map((clause, i) =>
          clause.strong || clause.alarm ? (
            <span
              key={clause.text + i}
              className={clause.alarm ? 'num text-cash-out' : 'num'}
              style={{ fontWeight: 600 }}
            >
              {clause.text}
            </span>
          ) : (
            <span key={clause.text + i}>{clause.text}</span>
          ),
        )}
      </p>

      {unlabelledHires > 0 && (
        <p className="t-caption mt-1.5">
          Only the first <span className="num">{LABELLED_HIRES}</span> hire months are labelled; the
          other <span className="num">{unlabelledHires}</span> dashed lines are hires too.
        </p>
      )}

      {/*
        Outside the figure on purpose: role="img" hides its own subtree from
        assistive tech, so a table nested inside it would be unreadable.
      */}
      <table className="sr-only">
        <caption>Cash balance at the end of each month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">With raise</th>
            {showRecommended && <th scope="col">At the recommended raise</th>}
            {showCounterfactual && <th scope="col">Without raise</th>}
            <th scope="col">Burn</th>
          </tr>
        </thead>
        <tbody>
          {results.chart.map((row) => (
            <tr key={row.month}>
              <th scope="row" className="num">
                {row.month}
              </th>
              <td className="num">
                {row.cashWithRaise === null ? 'out of cash' : formatMoney(row.cashWithRaise)}
              </td>
              {showRecommended && (
                <td className="num">
                  {row.cashAtRecommended === null
                    ? 'out of cash'
                    : formatMoney(row.cashAtRecommended)}
                </td>
              )}
              {showCounterfactual && (
                <td className="num">
                  {row.cashNoRaise === null ? 'out of cash' : formatMoney(row.cashNoRaise)}
                </td>
              )}
              <td className="num">{formatMoney(row.burn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
