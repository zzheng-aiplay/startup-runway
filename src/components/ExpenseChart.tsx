import { useEffect, useState, type CSSProperties } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatAxisMoney, formatMoney } from '../calc/format'
import { COLORS } from './palette'
import type { ModelResults } from '../calc/types'

/* ==========================================================================
   What you spend each month, stacked into the three things it is made of.

   This is the figure that explains why the raise is not burn × months: the steps
   are the months a hire lands, and the plateaus between them are what the plan
   actually costs to run. Nothing here is a Recharts default — grid, axes, legend
   and tooltip are all drawn to the memo's own scale.
   ========================================================================== */

/** Axis ticks and legend keys are apparatus, deliberately below the smallest type role. */
const CHROME = 11

const MARKER_LABEL = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
  className: 'num',
} as const

/** Hire months past this many go unlabelled; the dashed lines stay. */
const LABELLED_HIRES = 4

const SERIES = [
  { key: 'founderComp', label: 'Founder pay', color: COLORS.expenseFounders },
  { key: 'hireComp', label: 'Hires', color: COLORS.expenseHires },
  { key: 'operating', label: 'Everything else', color: COLORS.expenseOperating },
] as const

function KeyItem({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="key-square"
        style={{ flex: 'none', background: color } as CSSProperties}
      />
      <span
        className="text-ink-600"
        style={{ fontSize: CHROME, lineHeight: '16px', fontWeight: 500 }}
      >
        {label}
      </span>
    </li>
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

export function ExpenseChart({ results }: { results: ModelResults }) {
  const height = useFigureHeight()
  const { burn, hireEvents, inputs, projection } = results
  const target = inputs.scenario.targetRunwayMonths

  // The funded window is the interesting one; past it the plan is just a flat line.
  const data = projection.slice(0, Math.max(6, results.runway.targetPlusBuffer))
  const horizon = data.at(-1)?.month ?? 0
  const tickStep = horizon <= 12 ? 1 : horizon <= 36 ? 3 : 6
  const unlabelledHires = Math.max(0, hireEvents.length - LABELLED_HIRES)
  const grows = burn.burnAtEndOfRunway > burn.currentMonthlyBurn

  const sentence = grows
    ? `Burn starts at ${formatMoney(burn.currentMonthlyBurn)} a month and reaches ${formatMoney(burn.burnAtEndOfRunway)} by month ${target} as hires land.`
    : `Burn is flat at ${formatMoney(burn.currentMonthlyBurn)} a month for the whole plan.`

  return (
    <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--color-hairline)' }}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div>
          {/* 13px/600: a figure title, quieter than .t-value and heavier than .t-label. */}
          <div className="text-ink-800" style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600 }}>
            What you spend each month
          </div>
          <div className="t-caption mt-0.5">fully loaded, by month</div>
        </div>
        <ul className="flex items-center gap-4">
          {SERIES.map((s) => (
            <KeyItem key={s.key} color={s.color} label={s.label} />
          ))}
        </ul>
      </header>

      <figure role="img" aria-label={sentence} className="m-0 mt-3">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            {/* Horizontal hairlines only, so the hire lines read as events not chrome. */}
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
              domain={[0, (max: number) => max * 1.08]}
            />

            <ReferenceLine
              x={target}
              stroke={COLORS.ink300}
              strokeDasharray="2 4"
              label={{
                value: `TARGET M${target}`,
                position: 'insideTopRight',
                fill: COLORS.ink500,
                ...MARKER_LABEL,
              }}
            />

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
                        ...MARKER_LABEL,
                      }
                    : false
                }
              />
            ))}

            {/* Stacked in the order the money is committed: people you already have,
                people you are adding, then the bills. */}
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="stepAfter"
                stackId="burn"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={1}
                fill={s.color}
                fillOpacity={0.85}
                dot={false}
                isAnimationActive={false}
              />
            ))}

            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: COLORS.ink300, strokeWidth: 1, strokeDasharray: '2 3' }}
              content={({ active, label: month }) => {
                if (!active) return null
                const row = data.find((point) => point.month === Number(month))
                if (!row) return null
                const hire = hireEvents.find((event) => event.month === row.month)
                return (
                  <div
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-ink-200)',
                      borderRadius: 2,
                      padding: '10px 12px',
                      minWidth: 190,
                    }}
                  >
                    <div className="t-th mb-1.5">
                      MONTH <span className="num">{row.month}</span>
                    </div>
                    {SERIES.map((s) => (
                      <div
                        key={s.key}
                        className="flex items-baseline justify-between gap-4"
                      >
                        <span className="t-td text-ink-600">
                          <span
                            aria-hidden="true"
                            className="key-square mr-2"
                            style={{ background: s.color, verticalAlign: 'middle' }}
                          />
                          {s.label}
                        </span>
                        <span className="t-td num text-ink-900">{formatMoney(row[s.key])}</span>
                      </div>
                    ))}
                    <div
                      className="flex items-baseline justify-between gap-4"
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid var(--color-hairline)',
                      }}
                    >
                      <span className="t-th">Total</span>
                      <span className="t-total num">{formatMoney(row.burn)}</span>
                    </div>
                    {row.headcount > 0 && (
                      <div className="text-ink-600 mt-1.5" style={{ fontSize: CHROME, lineHeight: '16px' }}>
                        <span className="num">{row.headcount}</span> on payroll besides the founders
                      </div>
                    )}
                    {hire && (
                      <div className="text-ink-600" style={{ fontSize: CHROME, lineHeight: '16px' }}>
                        {hire.label.replace('+', '+ ')} starts
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        <table className="sr-only">
          <caption>Monthly spending by month, fully loaded</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {SERIES.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month}>
                <th scope="row" className="num">
                  {row.month}
                </th>
                {SERIES.map((s) => (
                  <td key={s.key} className="num">
                    {formatMoney(row[s.key])}
                  </td>
                ))}
                <td className="num">{formatMoney(row.burn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>

      <p className="mt-3 text-ink-600" style={{ fontSize: 12.5, lineHeight: '19px', maxWidth: '60ch' }}>
        {sentence}
      </p>
      {unlabelledHires > 0 && (
        <p className="t-caption mt-1">
          {unlabelledHires} further hiring {unlabelledHires === 1 ? 'month is' : 'months are'} marked
          but not labelled.
        </p>
      )}
    </div>
  )
}
