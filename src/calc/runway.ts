import {
  burnAtMonth,
  headcountAtMonth,
  hireCompAtMonth,
  targetPlusBuffer,
  type BurnContext,
} from './burn'
import { CASH_EPSILON, clamp, nonNegative, positiveInt } from './numbers'
import type {
  ChartPoint,
  CompanyInputs,
  HireEventGroup,
  MonthPoint,
  RunwayResults,
  ScenarioInputs,
} from './types'

/**
 * How far the simulation looks ahead. Deliberately far past anything a founder
 * would plan for: if it stopped at 240 months, a genuine 273-month runway would
 * come back as Infinity and the page would say the money never runs out. At this
 * horizon, Infinity means one thing only — nothing is being spent.
 */
export const SIM_HORIZON = 1200
/** Longest runway we are willing to print as a number. */
export const DISPLAY_CAP = 120

export interface RunwayPoint {
  months: number
  outOfCashMonth: number | null
}

/**
 * Months of runway from a starting balance.
 *
 * The trigger is `cash(m) <= 0`, not `< 0`: raising exactly the recommended amount lands
 * cash on precisely zero, and a strict comparison there silently returns "unlimited".
 * The fraction of the final month is clamped into [0,1] so float residue can't push the
 * answer past the month boundary either way.
 */
export function computeRunwayMonths(ctx: BurnContext, startingCash: number): RunwayPoint {
  if (!(startingCash > CASH_EPSILON)) return { months: 0, outOfCashMonth: 0 }

  let cash = startingCash
  for (let m = 1; m <= SIM_HORIZON; m++) {
    const burn = burnAtMonth(ctx, m)
    const opening = cash
    cash -= burn
    if (cash <= CASH_EPSILON) {
      const fraction = burn > 0 ? clamp(opening / burn, 0, 1) : 0
      return { months: m - 1 + fraction, outOfCashMonth: m }
    }
  }
  return { months: Number.POSITIVE_INFINITY, outOfCashMonth: null }
}

export function computeRunway(
  ctx: BurnContext,
  company: CompanyInputs,
  scenario: ScenarioInputs,
  plannedRaise: number,
): RunwayResults {
  const currentCash = nonNegative(company.currentCash)
  const target = positiveInt(scenario.targetRunwayMonths)
  const targetPlusBufferMonths = targetPlusBuffer(scenario)

  const withRaise = computeRunwayMonths(ctx, currentCash + nonNegative(plannedRaise))
  const withoutRaise = computeRunwayMonths(ctx, currentCash)

  // Cash left at the end of the target runway, with the planned raise.
  let cash = currentCash + nonNegative(plannedRaise)
  for (let m = 1; m <= target; m++) cash -= burnAtMonth(ctx, m)
  const cashAtEndOfTargetRunway = cash

  const finiteHorizon = Number.isFinite(withRaise.months)
    ? Math.ceil(withRaise.months)
    : targetPlusBufferMonths
  const noRaiseHorizon = Number.isFinite(withoutRaise.months) ? Math.ceil(withoutRaise.months) : 0
  const horizon = Math.min(
    DISPLAY_CAP,
    Math.max(targetPlusBufferMonths, finiteHorizon, noRaiseHorizon) + 2,
  )

  return {
    withRaise: withRaise.months,
    withoutRaise: withoutRaise.months,
    outOfCashMonthWithRaise: withRaise.outOfCashMonth,
    outOfCashMonthWithoutRaise: withoutRaise.outOfCashMonth,
    cashAtEndOfTargetRunway,
    bufferMonthsAchieved: Number.isFinite(withRaise.months)
      ? Math.max(0, withRaise.months - target)
      : Number.POSITIVE_INFINITY,
    hitsTargetRunway: withRaise.months >= target - 1e-9,
    targetPlusBuffer: targetPlusBufferMonths,
    horizon,
  }
}

export function buildProjection(
  ctx: BurnContext,
  company: CompanyInputs,
  plannedRaise: number,
  horizon: number,
): MonthPoint[] {
  const currentCash = nonNegative(company.currentCash)
  let withRaise = currentCash + nonNegative(plannedRaise)
  let withoutRaise = currentCash
  const points: MonthPoint[] = []

  for (let m = 1; m <= horizon; m++) {
    const hireComp = hireCompAtMonth(ctx, m)
    const burn = ctx.founderMonthlyComp + ctx.operatingMonthly + hireComp
    withRaise -= burn
    withoutRaise -= burn
    points.push({
      month: m,
      burn,
      founderComp: ctx.founderMonthlyComp,
      operating: ctx.operatingMonthly,
      hireComp,
      cashWithRaise: withRaise,
      cashWithoutRaise: withoutRaise,
      headcount: headcountAtMonth(ctx, m),
    })
  }
  return points
}

/**
 * Chart rows for Recharts. Month 0 carries the opening balances — the gap between the two
 * series at month 0 *is* the raise, visually. Each series is clamped at zero and then
 * nulled out, so each line terminates at its own wall instead of diving into negative
 * territory that reads as debt.
 */
export function buildChart(
  projection: MonthPoint[],
  currentCash: number,
  plannedRaise: number,
  recommendedRaise: number,
): ChartPoint[] {
  const cash = nonNegative(currentCash)
  const raise = nonNegative(plannedRaise)
  const recommended = nonNegative(recommendedRaise)
  // A third line only earns its place when the gap is big enough to see: a
  // rounding-sized difference would draw a second line on top of the first.
  const showRecommended = Math.abs(recommended - raise) > Math.max(1_000, recommended * 0.02)

  const rows: ChartPoint[] = [
    {
      month: 0,
      cashWithRaise: cash + raise,
      cashNoRaise: cash,
      cashAtRecommended: showRecommended ? cash + recommended : null,
      burn: projection[0]?.burn ?? 0,
    },
  ]

  let raiseAlive = cash + raise > CASH_EPSILON
  let noRaiseAlive = cash > CASH_EPSILON
  let recommendedAlive = showRecommended && cash + recommended > CASH_EPSILON
  let recommendedCash = cash + recommended

  for (const p of projection) {
    recommendedCash -= p.burn
    rows.push({
      month: p.month,
      cashWithRaise: raiseAlive ? Math.max(0, p.cashWithRaise) : null,
      cashNoRaise: noRaiseAlive ? Math.max(0, p.cashWithoutRaise) : null,
      cashAtRecommended: recommendedAlive ? Math.max(0, recommendedCash) : null,
      burn: p.burn,
    })
    if (p.cashWithRaise <= CASH_EPSILON) raiseAlive = false
    if (p.cashWithoutRaise <= CASH_EPSILON) noRaiseAlive = false
    if (recommendedCash <= CASH_EPSILON) recommendedAlive = false
  }
  return rows
}

/** Hires grouped by start month, so the chart draws one marker per month. */
export function buildHireEvents(ctx: BurnContext, horizon: number): HireEventGroup[] {
  const byMonth = new Map<number, HireEventGroup>()

  for (const h of ctx.hireCosts) {
    if (h.headcount <= 0 || h.monthlyCost <= 0) continue
    const existing = byMonth.get(h.startMonth)
    if (existing) {
      existing.roles.push({ role: h.role, headcount: h.headcount })
      existing.monthlyBurnDelta += h.monthlyCost
    } else {
      byMonth.set(h.startMonth, {
        month: h.startMonth,
        roles: [{ role: h.role, headcount: h.headcount }],
        monthlyBurnDelta: h.monthlyCost,
        cumulativeHeadcount: 0,
        label: '',
        afterTarget: h.afterTarget,
        beyondHorizon: h.beyondHorizon,
      })
    }
  }

  return [...byMonth.values()]
    .sort((a, b) => a.month - b.month)
    .filter((g) => g.month <= horizon)
    .map((g) => {
      const heads = g.roles.reduce((acc, r) => acc + r.headcount, 0)
      const label =
        g.roles.length === 1
          ? `+${g.roles[0].headcount} ${g.roles[0].role}`
          : `+${heads} hires`
      return { ...g, label, cumulativeHeadcount: headcountAtMonth(ctx, g.month) }
    })
}
