import type { ReactNode } from 'react'
import { formatMoney, formatMonths, formatPct } from '../calc/format'
import type { ModelResults } from '../calc/types'
import { Num } from './primitives'

/**
 * The footnotes. Nine simplifications the engine makes, in the order a reader
 * trips over them — and where a sentence stands on a number, it carries the
 * reader's own number rather than a generic example. Degenerate states (no
 * buffer, no pool, no usable cap) drop their parenthetical instead of printing
 * a hollow one.
 */
export function Assumptions({ results }: { results: ModelResults }) {
  const { burn, capital, safe, gates, inputs } = results
  // The engine prices the buffer in whole months, so the footnote has to quote the
  // rounded figure or it contradicts the raise it is explaining.
  const bufferMonths = Math.max(0, Math.round(inputs.scenario.bufferMonths))
  const payrollLoad = inputs.company.payrollLoadRate

  // With no usable SAFE money there is no cap to quote: blendedCap falls back to the
  // scenario's headline cap, which is a term someone typed, not an outcome.
  const hasSafeMoney = safe.totalSafeOwnership > 0 && !gates.hasInvalidCap

  const showBuffer = bufferMonths > 0 && capital.bufferAmount > 0
  // Neither figure depends on the founder split, so both survive a half-typed one.
  // An oversold round would land the pool below zero, though, so that one drops out.
  const showPool = hasSafeMoney && !gates.safeOversold && safe.poolPreSafePct > 0
  const showCap = hasSafeMoney

  const items: { key: string; body: ReactNode }[] = [
    {
      key: 'prorate',
      body: 'Burn is constant within a month; nothing is prorated mid-month.',
    },
    {
      key: 'hire-day-one',
      body: 'A hire costs their full loaded salary from day one of their start month.',
    },
    {
      key: 'benefits',
      body: (
        <>
          Benefits are a flat percentage on top of salary, covering payroll tax, insurance and
          tooling
          {payrollLoad > 0 && (
            <>
              {' '}
              (yours: <Num>{formatPct(payrollLoad, 1)}</Num> on new hires)
            </>
          )}
          .
        </>
      ),
    },
    {
      key: 'founder-comp',
      body: (
        <>
          Founder salaries are part of burn; founder equity is not an expense
          {burn.founderMonthlyComp > 0 && (
            <>
              {' '}
              (your salaries add <Num>{formatMoney(burn.founderMonthlyComp)}</Num> a month to burn,
              benefits included)
            </>
          )}
          .
        </>
      ),
    },
    {
      key: 'buffer',
      body: (
        <>
          The buffer is extra months of runway beyond your target, priced at the burn you will have
          then — so it grows with your hiring plan and it is already inside the recommended raise
          {showBuffer && (
            <>
              {' '}
              (yours: <Num>{formatMonths(bufferMonths)}</Num>,{' '}
              <Num>{formatMoney(capital.bufferAmount)}</Num>)
            </>
          )}
          .
        </>
      ),
    },
    {
      key: 'cap',
      body: (
        <>
          SAFEs convert at their post-money cap: investor ownership is investment ÷ cap. A discount
          is modelled as an equivalent lower cap, which holds only if your next round prices at or
          above that cap
          {showCap && (
            <>
              {' '}
              (your SAFEs convert at an effective <Num>{formatMoney(safe.blendedCap)}</Num> cap)
            </>
          )}
          .
        </>
      ),
    },
    {
      key: 'pool-first',
      body: (
        <>
          The pool you ask for is a share of the company <em>after</em> the round, so it is set
          aside before the SAFEs convert and grossed up to survive them — the founders carry that
          gross-up and the incoming investors do not
          {showPool && (
            <>
              {' '}
              (yours: <Num>{formatPct(safe.poolPreSafePct, 1)}</Num> set aside to leave{' '}
              <Num>{formatPct(safe.poolPostRoundPct, 1)}</Num> after the round)
            </>
          )}
          .
        </>
      ),
    },
    {
      key: 'starting-table',
      body: 'This model assumes the founders plus the option pool own 100% of the company today. Advisor or angel shares from before this round are not modelled; folding them into the pool is a fair approximation.',
    },
    {
      key: 'not-modelled',
      body: 'Not modelled at all: revenue, interest earned, MFN, pro-rata rights, note interest, and every term of an actual priced round.',
    },
  ]

  return (
    <section
      aria-label="Model assumptions"
      style={{ marginTop: 56, paddingTop: 20, borderTop: '1px solid var(--color-rule)' }}
    >
      <div className="t-eyebrow mb-3">Model assumptions</div>
      <ul className="list-none m-0 p-0 min-[900px]:columns-2" style={{ columnGap: 48 }}>
        {items.map((item) => (
          <li
            key={item.key}
            className="relative text-ink-600 mb-2 last:mb-0"
            /* 12.5/20 is the footnote size the type scale does not name: a step
               below t-body, but with more leading than t-small so nine of these
               stay readable in two columns. */
            style={{ fontSize: 12.5, lineHeight: '20px', paddingLeft: 14, breakInside: 'avoid' }}
          >
            <span aria-hidden="true" className="absolute left-0 top-0 text-ink-300">
              ·
            </span>
            {item.body}
          </li>
        ))}
      </ul>
      <p className="t-small" style={{ marginTop: 16 }}>
        A planning calculator, not legal, tax or accounting advice. Actual ownership depends on your
        real financing documents. Rounded to whole dollars. Nothing you type leaves this browser unless you copy a plan link or
        download a plan file.
      </p>
    </section>
  )
}
