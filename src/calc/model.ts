import { buildBurnContext, summarizeBurn, targetPlusBuffer } from './burn'
import { computeCapital } from './capital'
import { formatMoney, formatMonths, formatPct } from './format'
import { nonNegative, positiveInt, sum } from './numbers'
import { buildChart, buildHireEvents, buildProjection, computeRunway } from './runway'
import { HIGH_DILUTION_THRESHOLD, computeSafe } from './safe'
import type {
  AppState,
  ModelInputs,
  ModelResults,
  ModelWarning,
  ScenarioSummary,
} from './types'

/** Ignore rounding dust when reconciling the raise against the investor checks. */
const RECONCILE_TOLERANCE = 1

/**
 * The single entry point. Every number the UI renders comes from here — no component
 * derives its own, so the cards, the cap table, the chart and the "show the math"
 * blocks cannot drift apart.
 */
export function computeModel(inputs: ModelInputs): ModelResults {
  const { company, scenario } = inputs
  const ctx = buildBurnContext(company, scenario)
  const capital = computeCapital(ctx, company, scenario)
  const runway = computeRunway(ctx, company, scenario, capital.plannedRaise)
  const burn = summarizeBurn(ctx, scenario, runway.horizon)
  const { safe, gates } = computeSafe(company, scenario)
  const projection = buildProjection(ctx, company, capital.plannedRaise, runway.horizon)
  const chart = buildChart(
    projection,
    company.currentCash,
    capital.plannedRaise,
    capital.recommendedRaise,
  )
  const hireEvents = buildHireEvents(ctx, runway.horizon)

  const results: ModelResults = {
    inputs,
    burn,
    capital,
    runway,
    safe,
    gates,
    projection,
    chart,
    hireEvents,
    warnings: [],
  }
  results.warnings = collectWarnings(results)
  return results
}

function collectWarnings(r: ModelResults): ModelWarning[] {
  const { company, scenario } = r.inputs
  const w: ModelWarning[] = []
  const target = positiveInt(scenario.targetRunwayMonths)

  // --- founders -----------------------------------------------------------
  if (company.founders.length === 0) {
    w.push({
      code: 'no-founders',
      severity: 'error',
      field: 'founders',
      message: 'Add at least one founder to see ownership.',
    })
  } else if (!r.gates.founderSplitValid) {
    const total = sum(company.founders.map((f) => nonNegative(f.equityShare)))
    w.push({
      code: 'founder-split-sum',
      severity: 'error',
      field: 'founders',
      message: `The founder split totals ${formatPct(total)} — it has to total 100%.`,
    })
  }

  // --- burn ---------------------------------------------------------------
  // Gated on the whole funded window, not on month 1: a plan whose first hire lands
  // in month 4 is not a plan that spends nothing.
  if (r.capital.cashNeeded <= 0) {
    w.push({
      code: 'zero-burn',
      severity: 'info',
      field: 'expenses',
      message: 'Nothing in this plan spends anything yet. Add salaries or costs to see a runway.',
    })
  } else if (r.burn.currentMonthlyBurn <= 0) {
    const firstSpend = r.burn.burnByMonth.findIndex((b) => b > 0) + 1
    w.push({
      code: 'zero-burn',
      severity: 'info',
      field: 'expenses',
      message: `Nothing is spent until month ${firstSpend}, so month 1 burn reads ${formatMoney(0)}.`,
    })
  }

  // --- hires --------------------------------------------------------------
  const afterTarget = r.burn.hireCosts.filter(
    (h) => h.afterTarget && !h.beyondHorizon && h.monthlyCost > 0,
  )
  if (afterTarget.length > 0) {
    w.push({
      code: 'hire-after-target',
      severity: 'info',
      field: 'hires',
      message: `${listRoles(afterTarget)} start${afterTarget.length === 1 ? 's' : ''} after your ${target}-month target, so ${afterTarget.length === 1 ? 'it is' : 'they are'} funded out of the buffer.`,
    })
  }
  const beyondHorizon = r.burn.hireCosts.filter((h) => h.beyondHorizon && h.monthlyCost > 0)
  if (beyondHorizon.length > 0) {
    w.push({
      code: 'hire-beyond-horizon',
      severity: 'warn',
      field: 'hires',
      message: `${listRoles(beyondHorizon)} start${beyondHorizon.length === 1 ? 's' : ''} after month ${targetPlusBuffer(scenario)}, past the end of this plan, so ${beyondHorizon.length === 1 ? 'it is' : 'they are'} not funded by this raise.`,
    })
  }

  // --- the raise ----------------------------------------------------------
  if (r.capital.isOverridden && r.capital.raiseGap < -RECONCILE_TOLERANCE) {
    w.push({
      code: 'raise-short',
      severity: 'warn',
      field: 'raise',
      message: `${formatMoney(r.capital.plannedRaise)} funds ${formatMonths(r.runway.withRaise)} against your ${target}-month target — ${formatMoney(Math.abs(r.capital.raiseGap))} short of the recommendation.`,
    })
  } else if (r.capital.isOverridden && r.capital.raiseGap > RECONCILE_TOLERANCE) {
    w.push({
      code: 'raise-over',
      severity: 'info',
      field: 'raise',
      message: `${formatMoney(Math.abs(r.capital.raiseGap))} more than the recommendation — that buys ${formatMonths(Math.max(0, r.runway.withRaise - r.runway.targetPlusBuffer))} beyond your target plus buffer.`,
    })
  }
  if (Math.abs(r.capital.unallocated) > RECONCILE_TOLERANCE) {
    const over = r.capital.unallocated < 0
    w.push({
      code: 'raise-unallocated',
      severity: 'warn',
      field: 'investors',
      message: over
        ? `Your investors add up to ${formatMoney(r.capital.committedFromInvestors)}, which is ${formatMoney(-r.capital.unallocated)} more than the ${formatMoney(r.capital.plannedRaise)} you plan to raise. The dilution below reflects the checks, not the plan.`
        : `Your investors add up to ${formatMoney(r.capital.committedFromInvestors)} of the ${formatMoney(r.capital.plannedRaise)} you plan to raise — ${formatMoney(r.capital.unallocated)} is unallocated, so the dilution below understates the real cost.`,
    })
  }

  // --- SAFE terms ---------------------------------------------------------
  const funded = r.safe.investors.filter((i) => i.investment > 0)
  const invalid = funded.filter((i) => i.capInvalid)
  if (invalid.length > 0) {
    w.push({
      code: 'invalid-cap',
      severity: 'error',
      field: 'investors',
      message: `${invalid.map((i) => i.name).join(', ')} ${invalid.length === 1 ? 'has' : 'have'} no valuation cap, so ownership can't be worked out. Enter a post-money cap.`,
    })
  }
  if (funded.length > 1) {
    const caps = new Set(funded.map((i) => i.postMoneyCap))
    if (caps.size > 1) {
      w.push({
        code: 'mixed-caps',
        severity: 'warn',
        field: 'investors',
        message:
          'Different valuation caps mean different economic terms. Make sure there is a deliberate reason for this.',
      })
    }
    const discounts = new Set(funded.map((i) => i.discountRate))
    if (discounts.size > 1) {
      w.push({
        code: 'mixed-discounts',
        severity: 'warn',
        field: 'investors',
        message: 'These investors have different discounts, which is another difference in terms.',
      })
    }
  }
  if (r.gates.safeOversold) {
    const worst = [...funded].sort((a, b) => b.ownership - a.ownership)[0]
    w.push({
      code: 'safe-oversold',
      severity: 'error',
      field: 'investors',
      message: worst
        ? `These SAFEs add up to ${formatPct(r.safe.totalSafeOwnership, 1)} of the company, so the round as entered is impossible. ${worst.name} alone is ${formatPct(worst.ownership, 1)} — ${formatMoney(worst.investment)} against a ${formatMoney(worst.effectiveCap)} cap.`
        : `These SAFEs add up to ${formatPct(r.safe.totalSafeOwnership, 1)} of the company, so the round as entered is impossible.`,
    })
  } else if (r.safe.totalSafeOwnership > HIGH_DILUTION_THRESHOLD) {
    w.push({
      code: 'safe-very-high',
      severity: 'warn',
      field: 'investors',
      message: `These SAFEs total ${formatPct(r.safe.totalSafeOwnership, 1)} of the company, which is a lot for one early round. Check the caps.`,
    })
  }
  if (funded.some((i) => i.discountRate > 0)) {
    w.push({
      code: 'discount-modeled',
      severity: 'info',
      field: 'investors',
      message:
        'A discount is modelled here as an equivalent lower cap. That matches a real SAFE as long as your next round prices at or above the cap; if it prices below, the discount comes off that lower price and costs you more than shown here.',
    })
  }

  // --- option pool --------------------------------------------------------
  if (r.safe.poolIsNoOp) {
    w.push({
      code: 'pool-no-op',
      severity: 'info',
      field: 'pool',
      message: `No new pool is created — your existing ${formatPct(scenario.optionPool.currentPct)} pool is already at or above this target.`,
    })
  }
  if (r.safe.poolPreSafePct >= 0.35) {
    w.push({
      code: 'pool-too-large',
      severity: 'warn',
      field: 'pool',
      message: `A ${formatPct(r.safe.poolPreSafePct)} option pool is unusually large — pre-seed pools are typically 10-15%.`,
    })
  }

  return w
}

function listRoles(hires: { role: string; headcount: number }[]): string {
  return hires.map((h) => `${h.headcount}× ${h.role || 'hire'}`).join(', ')
}

/** One row per scenario for the side-by-side comparison. */
export function summarizeScenarios(state: AppState): ScenarioSummary[] {
  return (['lean', 'base', 'aggressive'] as const).map((id) => {
    const scenario = state.scenarios[id]
    const r = computeModel({ company: state.company, scenario })
    const target = positiveInt(scenario.targetRunwayMonths)
    return {
      id,
      label: scenario.label,
      blurb: scenario.blurb,
      isActive: state.activeScenario === id,
      plannedRaise: r.capital.plannedRaise,
      recommendedRaise: r.capital.recommendedRaise,
      targetRunwayMonths: target,
      bufferMonths: Math.max(0, Math.round(scenario.bufferMonths) || 0),
      runwayMonths: r.runway.withRaise,
      hitsTargetRunway: r.runway.hitsTargetRunway,
      currentMonthlyBurn: r.burn.currentMonthlyBurn,
      burnAtEndOfRunway: r.burn.burnAtEndOfRunway,
      cashNeeded: r.capital.cashNeeded,
      blendedCap: r.safe.blendedCap,
      totalSafeOwnership: r.safe.totalSafeOwnership,
      poolIncrementPoints: r.safe.dilutionPointsFromPool,
      poolAfterPct: r.safe.poolPostRoundPct,
      founderDilution: r.safe.founderDilution,
      founderBlockAfter: r.safe.founderBlockAfter,
      ownershipComputable: r.gates.ownershipComputable,
      headcountAtEnd: r.burn.headcountByMonth[Math.min(target, r.burn.headcountByMonth.length) - 1] ?? 0,
    }
  })
}
