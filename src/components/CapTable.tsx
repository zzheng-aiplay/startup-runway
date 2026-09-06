import { Fragment, useId } from 'react'
import { formatMoney, formatMoneyCompact, formatPct, formatPoints } from '../calc/format'
import { roundSharesToTotal, sum } from '../calc/numbers'
import type { HolderKind, ModelResults, ModelWarning, WarningCode } from '../calc/types'
import { withColors } from './palette'
import { Banner, InfoTip, Num, type Glossary } from './primitives'

/* ==========================================================================
   The cap table — the one artefact a founder screenshots and checks against the
   SAFEs on their desk. So it reconciles on the page: each column is rounded by
   largest remainder to the total printed under it, rather than each row being
   rounded on its own and hoping the column adds up.
   ========================================================================== */

/**
 * 12/16. One notch under .t-td and tighter than .t-caption's 18px, so a cell's
 * second line hugs the first instead of floating between rows.
 */
const SUBLINE = { fontSize: 12, lineHeight: '16px' } as const

/**
 * A left gutter on the three numeric columns. .memo-table pads cells vertically
 * only, and a nowrap header pins each column to its own widest figure — so in
 * the narrow rail two right-aligned numbers can otherwise end up touching.
 */
const NUM_COL = 'pl-3'

const GROUPS: { kind: HolderKind; label: string }[] = [
  { kind: 'founder', label: 'Founders' },
  { kind: 'investor', label: 'Investors' },
  { kind: 'pool', label: 'Option pool' },
]

/**
 * The reasons ownership can't be worked out, worst first. `no-founders` is in
 * here because it also closes the gate, and a dimmed table with no explanation
 * is worse than the wrong explanation.
 */
const BLOCKING_CODES: WarningCode[] = [
  'safe-oversold',
  'invalid-cap',
  'founder-split-sum',
  'no-founders',
]

/** An oversold round drives holdings negative. A negative percentage is never printed. */
function floor0(value: number): number {
  return Math.max(0, value)
}

/**
 * One column of percentages, plus the total to print under it. `whole` forces
 * the two company-wide columns to exactly 100%; the New column is only ever a
 * slice, so it reconciles to its own sum instead.
 *
 * The scaling step matters. The founder-split gate passes any split within half
 * a basis point of 100%, and largest-remainder rounding settles that residue by
 * clawing hundredths off the *smallest* holders — including ones sitting at
 * zero, which is how a cap table ends up printing −0.01%. Scaled onto its total
 * first, the rounding only ever hands units out.
 */
function column(values: number[], whole: boolean): { cells: number[]; total: number } {
  const clamped = values.map(floor0)
  const raw = sum(clamped)
  const toWhole = whole && raw > 0
  const shares = toWhole ? clamped.map((value) => value / raw) : clamped
  const target = toWhole ? 100 : Number((raw * 100).toFixed(2))
  const cells = roundSharesToTotal(shares, 2, target).map((points) => points / 100)
  return { cells, total: sum(cells) }
}

/**
 * Holder names are free text and can be emptied. Falling back to the input's own
 * placeholder keeps the row reading the same as the field just cleared.
 */
function holderName(kind: HolderKind, holder: string, indexWithinKind: number): string {
  const typed = holder.trim()
  if (typed) return typed
  if (kind === 'pool') return 'Option pool'
  return `${kind === 'founder' ? 'Founder' : 'Investor'} ${indexWithinKind + 1}`
}

function firstBlocker(warnings: ModelWarning[]): ModelWarning | undefined {
  for (const code of BLOCKING_CODES) {
    const hit = warnings.find((w) => w.code === code)
    if (hit) return hit
  }
  return undefined
}

/** Nobody owns `0.0%` of anything — a holder with no stake yet gets a dash. */
function Dash() {
  return <span className="text-ink-500">—</span>
}

export function CapTable({ results, tip }: { results: ModelResults; tip?: Glossary }) {
  const titleId = useId()
  const computable = results.gates.ownershipComputable
  const rows = withColors(results.safe.capTable)
  const terms = new Map(results.safe.investors.map((inv) => [inv.id, inv]))
  const hasPool = rows.some((row) => row.kind === 'pool')

  const today = column(
    rows.map((row) => row.before),
    computable,
  )
  // Rows that got nothing this round go in as 0 and print as a dash. They can't
  // pick up a remainder unit on the way: largest-remainder hands out no more
  // units than there are non-zero remainders.
  const created = column(
    rows.map((row) => row.newOwnership ?? 0),
    false,
  )
  const after = column(
    rows.map((row) => row.after),
    computable,
  )

  // Whether a column has anything in it at all, asked exactly the way each cell
  // above asks it — otherwise a holding too small to round to 0.01% prints `0%` in
  // its row while the total under it prints a dash.
  const anyToday = rows.some((row) => row.before > 0)
  const anyCreated = rows.some((row) => (row.newOwnership ?? 0) > 0)
  const anyAfter = rows.some((row) => row.after > 0)

  const blocker = computable ? undefined : firstBlocker(results.warnings)
  // Dimmed, not unreadable: this is the moment the founder most needs to read the
  // table, so the greyest it goes is ink-500 (4.96:1).
  const dim = computable ? '' : ' text-ink-500'
  const subInk = 'text-ink-500'
  const changeInk = computable ? 'text-ink-600' : 'text-ink-500'

  return (
    <div>
      <div className="mb-4">
        {/* 13/600 sits between .t-group and .t-value — a table title, not a section head. */}
        <h3
          id={titleId}
          className="text-ink-800"
          style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, margin: 0 }}
        >
          Who owns what
          {tip && <InfoTip {...tip} />}
        </h3>
        {/* The pool clause is conditional because a company with no pool would be
            told to look for a row that is not there. */}
        <p className="t-caption mt-1">
          Every percentage is a share of the whole company, fully diluted — a simplified
          post-money SAFE model, not your real cap table.
          {hasPool && ' The option pool counts as owned.'}
        </p>
      </div>

      {blocker && (
        <div className="mb-4">
          {/* Not a live region: the input that caused it already announces this
              sentence, and two role=alert nodes read it out twice per keystroke. */}
          <Banner tone="error" live={false}>
            {blocker.message}
          </Banner>
        </div>
      )}

      <div className="max-[899px]:overflow-x-auto">
        <table className="memo-table max-[899px]:min-w-[480px]" aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col" className="t-th">
                Holder
              </th>
              <th scope="col" className={`t-th ${NUM_COL}`}>
                Today
              </th>
              <th scope="col" className={`t-th ${NUM_COL}`}>
                New
              </th>
              <th scope="col" className={`t-th ${NUM_COL}`}>
                After round
              </th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(({ kind, label }) => {
              // capTable already runs founders, then investors, then the pool, so
              // filtering keeps every row in engine order.
              const group = rows
                .map((row, index) => ({ row, index }))
                .filter(({ row }) => row.kind === kind)
              if (group.length === 0) return null

              return (
                <Fragment key={kind}>
                  <tr data-group="true">
                    <th scope="colgroup" colSpan={4} className={`t-th bg-sunken${dim}`}>
                      {label}
                    </th>
                  </tr>
                  {group.map(({ row, index }, withinKind) => {
                    const inv = kind === 'investor' ? terms.get(row.id) : undefined
                    return (
                      <tr key={row.id}>
                        <th scope="row" style={{ fontWeight: 'inherit' }}>
                          <span className="flex items-center gap-2">
                            <span className="key-square" style={{ background: row.color }} />
                            <span className={`t-td${dim}`}>
                              {holderName(kind, row.holder, withinKind)}
                            </span>
                          </span>
                          {inv && (
                            <span className={`block pl-4 ${subInk}`} style={SUBLINE}>
                              <Num>{formatMoney(inv.investment)}</Num>
                              {/* A cap of 0 is a cap nobody has entered yet, not a $0 valuation. */}
                              {inv.postMoneyCap > 0 ? (
                                <>
                                  {' at '}
                                  <Num>{formatMoneyCompact(inv.postMoneyCap)}</Num> cap
                                </>
                              ) : (
                                ', no cap entered yet'
                              )}
                              {inv.discountRate > 0 && (
                                <>
                                  {' · '}
                                  <Num>{formatPct(inv.discountRate)}</Num> discount
                                  {inv.effectiveCap > 0 && (
                                    <>
                                      {' · '}modeled at a{' '}
                                      <Num>{formatMoneyCompact(inv.effectiveCap)}</Num> effective cap
                                    </>
                                  )}
                                </>
                              )}
                            </span>
                          )}
                        </th>
                        <td className={`t-td num ${NUM_COL}${dim}`}>
                          {row.before > 0 ? formatPct(today.cells[index]) : <Dash />}
                        </td>
                        {/* A holder buying nothing this round owns nothing new — a dash, not 0%. */}
                        <td className={`t-td num ${NUM_COL}${dim}`}>
                          {row.newOwnership !== null && row.newOwnership > 0 ? (
                            formatPct(created.cells[index])
                          ) : (
                            <Dash />
                          )}
                        </td>
                        {/* No stated position, no stated move: an oversold round drives
                            the founder block below zero, and `−152.5 pts` under a dash
                            would be arithmetic about a company that cannot exist. */}
                        <td className={`t-td num ${NUM_COL}${dim}`}>
                          {row.after > 0 ? (
                            <>
                              {formatPct(after.cells[index])}
                              {/* Points, not percent, and never red: dilution is arithmetic, not an error. */}
                              <span className={`block num ${changeInk}`} style={SUBLINE}>
                                {formatPoints(row.change, 2)}
                              </span>
                            </>
                          ) : (
                            <Dash />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            {/* With no holders at all there is nothing to total — and a company is
                never 0% owned, so printing "0%" here would be the one false line. */}
            {rows.length > 0 && (
              <tr data-total="true">
                <td className={`t-th${dim}`}>Total</td>
                {/* Each total is the sum of the cells actually printed above it, so an
                    empty column totals a dash rather than an invented 0%. */}
                <td className={`t-total num ${NUM_COL}${dim}`}>
                  {anyToday ? formatPct(today.total) : <Dash />}
                </td>
                <td className={`t-total num ${NUM_COL}${dim}`}>
                  {anyCreated ? formatPct(created.total) : <Dash />}
                </td>
                <td className={`t-total num ${NUM_COL}${dim}`}>
                  {anyAfter ? formatPct(after.total) : <Dash />}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
