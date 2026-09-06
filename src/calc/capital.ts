import { burnBetween, targetPlusBuffer, type BurnContext } from './burn'
import { nonNegative, positiveInt, sum } from './numbers'
import type { CapitalResults, CompanyInputs, ScenarioInputs } from './types'

/**
 * How much cash the plan actually consumes, month by month.
 *
 *   burn through runway = sum of burn over months 1..N
 *   buffer              = sum of burn over months N+1..N+B   (disjoint from the above)
 *   recommended raise   = max(0, burn through runway + buffer - cash on hand)
 *
 * Deliberately never "burn × months": once a hire lands mid-plan the two disagree, and
 * the month-by-month sum is the honest one.
 */
export function computeCapital(
  ctx: BurnContext,
  company: CompanyInputs,
  scenario: ScenarioInputs,
): CapitalResults {
  const target = positiveInt(scenario.targetRunwayMonths)
  const horizon = targetPlusBuffer(scenario)
  const currentCash = nonNegative(company.currentCash)

  const burnThroughRunway = burnBetween(ctx, 1, target)
  const bufferAmount = burnBetween(ctx, target + 1, horizon)
  const cashNeeded = burnThroughRunway + bufferAmount
  const recommendedRaise = Math.max(0, cashNeeded - currentCash)

  const override = scenario.plannedRaiseOverride
  const isOverridden = override !== null && Number.isFinite(override)
  const plannedRaise = isOverridden ? nonNegative(override as number) : recommendedRaise

  const committedFromInvestors = sum(scenario.investors.map((i) => nonNegative(i.investment)))

  return {
    burnThroughRunway,
    bufferAmount,
    cashNeeded,
    recommendedRaise,
    plannedRaise,
    isOverridden,
    raiseGap: plannedRaise - recommendedRaise,
    committedFromInvestors,
    unallocated: plannedRaise - committedFromInvestors,
  }
}
