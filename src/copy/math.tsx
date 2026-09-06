import { Disclosure, Formula, Sub } from '../components/primitives'
import { formatMoney, formatMonths, formatPct, MINUS } from '../calc/format'
import { founderPhrase } from './people'
import type { ModelResults } from '../calc/types'

/* ==========================================================================
   "Show the math". Five panels, each one plain English first, then the shape
   of the formula, then the same formula with the reader's own numbers in it.
   Every panel reads the same ModelResults the cards read, so the arithmetic on
   screen and the arithmetic behind it cannot drift apart.
   ========================================================================== */

export function BurnMath({ results }: { results: ModelResults }) {
  const { burn, inputs } = results
  const hires = burn.hireCosts.filter((h) => h.startMonth <= 1 && h.monthlyCost > 0)
  const load = inputs.company.payrollLoadRate

  return (
    <Disclosure label="Show the burn math" openLabel="Hide the burn math">
      <Formula
        plain={`Burn is what ${founderPhrase(burn.founderCosts.length)} are paid, plus benefits on top, plus the bills — and then anyone you have hired by that month.`}
        symbolic="burn(month) = founder pay + benefits + operating costs + hires already started"
        substituted={
          <>
            burn(1) = <Sub>{formatMoney(burn.founderMonthlyComp)}</Sub> {' + '}
            <Sub>{formatMoney(burn.operatingMonthly)}</Sub>
            {hires.length > 0 ? (
              <>
                {' + '}
                <Sub>{formatMoney(burn.breakdown.hireComp)}</Sub>
              </>
            ) : null}
          </>
        }
        result={`${formatMoney(burn.currentMonthlyBurn)} in month 1`}
      />
      <Formula
        plain={`Each founder's salary carries their own benefits rate. Hires carry one company-wide payroll load of ${formatPct(load, 0)}.`}
        symbolic="monthly cost = annual salary ÷ 12 × (1 + load)"
        substituted={
          <>
            {burn.founderCosts.map((f) => (
              <div key={f.id}>
                {f.name || 'Founder'}: <Sub>{formatMoney(f.annualSalary)}</Sub> ÷ 12 × (1 +{' '}
                <Sub>{formatPct(f.benefitsRate, 0)}</Sub>) = {formatMoney(f.monthlyCost)}
              </div>
            ))}
            {burn.hireCosts
              .filter((h) => h.monthlyCost > 0)
              .map((h) => (
                <div key={h.id}>
                  {h.role || 'Hire'} ×{h.headcount}: <Sub>{formatMoney(h.annualSalary)}</Sub> ÷ 12 ×{' '}
                  {h.headcount} × (1 + <Sub>{formatPct(load, 0)}</Sub>) ={' '}
                  {formatMoney(h.monthlyCost)} from month {h.startMonth}
                </div>
              ))}
          </>
        }
        result={`${formatMoney(burn.currentMonthlyBurn)} now, ${formatMoney(burn.burnAtEndOfRunway)} by month ${inputs.scenario.targetRunwayMonths}`}
      />
    </Disclosure>
  )
}

export function RaiseMath({ results }: { results: ModelResults }) {
  const { capital, burn, inputs } = results
  const target = inputs.scenario.targetRunwayMonths
  // Flat-burn plans are the tool's own default case, and telling a founder their
  // burn rises when it does not is the fastest way to lose the panel's credibility.
  const rising = burn.burnAtEndOfRunway > burn.currentMonthlyBurn
  const buffer = Math.max(0, Math.round(inputs.scenario.bufferMonths) || 0)
  const cash = Math.max(0, inputs.company.currentCash)

  return (
    <Disclosure label="Show the raise math" openLabel="Hide the raise math">
      <Formula
        plain={`The raise is what it costs to run for ${target} months, plus the ${buffer ? `${buffer} months of` : ''} buffer you want left in the bank, minus the cash you already have.${rising ? ' It is a month-by-month sum rather than burn × months, because your burn changes as you hire.' : ''}`}
        symbolic={`raise = burn for months 1${MINUS}${target}${buffer ? ` + burn for months ${target + 1}${MINUS}${target + buffer}` : ''} ${MINUS} cash on hand`}
        substituted={
          <>
            <Sub>{formatMoney(capital.burnThroughRunway)}</Sub>
            {buffer > 0 ? (
              <>
                {' + '}
                <Sub>{formatMoney(capital.bufferAmount)}</Sub>
              </>
            ) : null}
            {` ${MINUS} `}
            <Sub>{formatMoney(cash)}</Sub>
          </>
        }
        result={formatMoney(capital.recommendedRaise)}
      />
      <Formula
        plain={
          rising
            ? `Burn rises from ${formatMoney(burn.currentMonthlyBurn)} to ${formatMoney(burn.burnAtEndOfRunway)} across those ${target} months, which is why the total is not one number multiplied by ${target}.`
            : `Nothing changes your burn inside those ${target} months, so here the total really is one number multiplied by ${target}.`
        }
        symbolic={`burn for months 1${MINUS}${target} = burn(1) + burn(2) + … + burn(${target})`}
        substituted={
          <>
            {rising ? 'average ' : ''}
            <Sub>{formatMoney(burn.averageMonthlyBurn)}</Sub> × {target} months
          </>
        }
        result={
          rising
            ? `${formatMoney(capital.burnThroughRunway)} (${formatMoney(burn.currentMonthlyBurn)} × ${target} would understate it by ${formatMoney(Math.max(0, capital.burnThroughRunway - burn.currentMonthlyBurn * target))})`
            : formatMoney(capital.burnThroughRunway)
        }
      />
    </Disclosure>
  )
}

export function RunwayMath({ results }: { results: ModelResults }) {
  const { capital, runway, inputs, projection } = results
  const cash = Math.max(0, inputs.company.currentCash)
  const out = runway.outOfCashMonthWithRaise
  // The projection stops at the display horizon, so a very long runway has no row
  // to divide — better to say that than to print "$0 ÷ $0".
  const beyondProjection = out !== null && out > projection.length
  // outOfCashMonth is 0 when the account is empty before month 1 — a sentinel, not a
  // month, and falsy, so it cannot be tested by truthiness.
  const alreadyEmpty = out === 0
  const lastFull = out !== null && out > 0 ? Math.max(0, out - 1) : projection.length
  const opening = lastFull > 0 ? projection[lastFull - 1]?.cashWithRaise ?? 0 : cash + capital.plannedRaise
  const finalBurn = out !== null && out > 0 ? (projection[out - 1]?.burn ?? 0) : 0

  return (
    <Disclosure label="Show the runway math" openLabel="Hide the runway math">
      <Formula
        plain="Runway is how many months the money in the bank covers. Each month subtracts that month's burn; the last month is counted as the fraction of it you can actually afford."
        symbolic="runway = whole months covered + (cash left ÷ that month's burn)"
        substituted={
          alreadyEmpty ? (
            <>
              there is <Sub>{formatMoney(cash + capital.plannedRaise)}</Sub> in the bank, so there is
              nothing to divide yet
            </>
          ) : out === null ? (
            <>
              <Sub>{formatMoney(cash + capital.plannedRaise)}</Sub> never runs out at this burn
            </>
          ) : beyondProjection ? (
            <>
              <Sub>{formatMoney(cash + capital.plannedRaise)}</Sub> outlasts the{' '}
              {projection.length} months this chart projects
            </>
          ) : (
            <>
              <Sub>{formatMoney(cash + capital.plannedRaise)}</Sub> covers {lastFull} whole months,
              then <Sub>{formatMoney(Math.max(0, opening))}</Sub> ÷{' '}
              <Sub>{formatMoney(finalBurn)}</Sub>
            </>
          )
        }
        result={formatMonths(runway.withRaise)}
      />
    </Disclosure>
  )
}

export function SafeMath({ results }: { results: ModelResults }) {
  const { safe, capital, gates } = results
  // Every other ownership surface refuses to answer a blocked question. This panel
  // has to refuse too, or it prints a founder share of −25% for an impossible round.
  const funded = safe.investors.filter((i) => i.investment > 0 && !i.capInvalid)

  if (!gates.ownershipComputable) {
    return (
      <Disclosure label="Show the dilution math" openLabel="Hide the dilution math">
        <p className="text-[13.5px] leading-[21px] text-ink-700 max-w-[62ch]">
          The maths is on hold: fix the inputs flagged above and the conversion, the option pool and
          each founder&rsquo;s share after the round will be worked through here.
        </p>
      </Disclosure>
    )
  }

  return (
    <Disclosure label="Show the dilution math" openLabel="Hide the dilution math">
      <Formula
        plain="On a post-money SAFE, an investor's share is simply their cheque divided by the valuation cap. Add them up and you have what the round costs in total."
        symbolic="investor share = investment ÷ post-money cap"
        substituted={
          funded.length === 0 ? (
            <>no investors yet</>
          ) : (
            <>
              {funded.map((i) => (
                <div key={i.id}>
                  {i.name || 'Investor'}: <Sub>{formatMoney(i.investment)}</Sub> ÷{' '}
                  <Sub>{formatMoney(i.effectiveCap)}</Sub>
                  {i.discountRate > 0
                    ? ` (${formatMoney(i.postMoneyCap)} cap less a ${formatPct(i.discountRate, 0)} discount)`
                    : ''}{' '}
                  = {formatPct(i.ownership)}
                </div>
              ))}
            </>
          )
        }
        result={`${formatPct(safe.totalSafeOwnership)} of the company for ${formatMoney(capital.committedFromInvestors)}`}
      />
      <Formula
        plain="Your own share shrinks in two steps: first the option pool is set aside, then the SAFEs convert on top of what is left."
        symbolic="your share after = your split × (1 − option pool) × (1 − total SAFE share)"
        substituted={
          <>
            {safe.founderRows.map((f) => (
              <div key={f.id}>
                {f.name || 'Founder'}:{' '}
                <Sub>
                  {formatPct(
                    safe.founderBlockBefore > 0 ? f.before / safe.founderBlockBefore : 0,
                    1,
                  )}
                </Sub>{' '}
                × (1 {MINUS} <Sub>{formatPct(safe.poolPreSafePct, 1)}</Sub>) × (1 {MINUS}{' '}
                <Sub>{formatPct(safe.totalSafeOwnership)}</Sub>) = {formatPct(f.after)}
              </div>
            ))}
          </>
        }
        result={`${founderPhrase(safe.founderRows.length)} hold ${formatPct(safe.founderBlockAfter)} after the round, down from ${formatPct(safe.founderBlockBefore)}`}
      />
    </Disclosure>
  )
}
