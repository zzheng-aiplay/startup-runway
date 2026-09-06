import { nonNegative, positiveInt, sum } from './numbers'
import type {
  BurnResults,
  CompanyInputs,
  FounderCost,
  HireCost,
  ScenarioInputs,
} from './types'

/**
 * Burn is a step function of the month: founders + operating expenses are flat, and
 * every hire adds a step at its start month. Nothing here multiplies "burn × months" —
 * that is the whole reason the projection is month-by-month.
 */
export interface BurnContext {
  founderMonthlyComp: number
  operatingMonthly: number
  founderCosts: FounderCost[]
  hireCosts: HireCost[]
}

export function buildBurnContext(
  company: CompanyInputs,
  scenario: ScenarioInputs,
): BurnContext {
  const payrollLoad = nonNegative(company.payrollLoadRate)
  const horizon = targetPlusBuffer(scenario)

  const founderCosts: FounderCost[] = company.founders.map((f) => ({
    id: f.id,
    name: f.name,
    annualSalary: nonNegative(f.annualSalary),
    benefitsRate: nonNegative(f.benefitsRate),
    monthlyCost: (nonNegative(f.annualSalary) / 12) * (1 + nonNegative(f.benefitsRate)),
  }))

  const hireCosts: HireCost[] = scenario.hires.map((h) => {
    const headcount = Math.max(0, Math.round(h.headcount) || 0)
    const startMonth = positiveInt(h.startMonth)
    return {
      id: h.id,
      role: h.role,
      headcount,
      annualSalary: nonNegative(h.annualSalary),
      startMonth,
      monthlyCost: headcount * (nonNegative(h.annualSalary) / 12) * (1 + payrollLoad),
      afterTarget: startMonth > scenario.targetRunwayMonths,
      beyondHorizon: startMonth > horizon,
    }
  })

  return {
    founderMonthlyComp: sum(founderCosts.map((f) => f.monthlyCost)),
    operatingMonthly: sum(company.expenses.map((e) => nonNegative(e.monthlyCost))),
    founderCosts,
    hireCosts,
  }
}

export function targetPlusBuffer(scenario: ScenarioInputs): number {
  return (
    positiveInt(scenario.targetRunwayMonths) + Math.max(0, Math.round(scenario.bufferMonths) || 0)
  )
}

/** Fully loaded cost of the hires on payroll in `month`. */
export function hireCompAtMonth(ctx: BurnContext, month: number): number {
  let total = 0
  for (const h of ctx.hireCosts) if (month >= h.startMonth) total += h.monthlyCost
  return total
}

export function headcountAtMonth(ctx: BurnContext, month: number): number {
  let total = 0
  for (const h of ctx.hireCosts) if (month >= h.startMonth) total += h.headcount
  return total
}

export function burnAtMonth(ctx: BurnContext, month: number): number {
  return ctx.founderMonthlyComp + ctx.operatingMonthly + hireCompAtMonth(ctx, month)
}

/** Inclusive sum of burn over [from, to]. Returns 0 when the window is empty. */
export function burnBetween(ctx: BurnContext, from: number, to: number): number {
  let total = 0
  for (let m = from; m <= to; m++) total += burnAtMonth(ctx, m)
  return total
}

export function summarizeBurn(
  ctx: BurnContext,
  scenario: ScenarioInputs,
  horizon: number,
): BurnResults {
  const target = positiveInt(scenario.targetRunwayMonths)
  const burnByMonth: number[] = []
  const headcountByMonth: number[] = []
  for (let m = 1; m <= horizon; m++) {
    burnByMonth.push(burnAtMonth(ctx, m))
    headcountByMonth.push(headcountAtMonth(ctx, m))
  }

  const currentMonthlyBurn = burnAtMonth(ctx, 1)
  const burnAtEndOfRunway = burnAtMonth(ctx, target)
  const averageMonthlyBurn = burnBetween(ctx, 1, target) / target

  return {
    founderMonthlyComp: ctx.founderMonthlyComp,
    operatingMonthly: ctx.operatingMonthly,
    currentMonthlyBurn,
    averageMonthlyBurn,
    burnAtEndOfRunway,
    burnGrowthOverRunway:
      currentMonthlyBurn > 0 ? burnAtEndOfRunway / currentMonthlyBurn - 1 : 0,
    hiresInMonthOne: ctx.hireCosts.some((h) => h.startMonth <= 1 && h.monthlyCost > 0),
    breakdown: {
      founderComp: ctx.founderMonthlyComp,
      operating: ctx.operatingMonthly,
      hireComp: hireCompAtMonth(ctx, 1),
      total: currentMonthlyBurn,
    },
    founderCosts: ctx.founderCosts,
    hireCosts: ctx.hireCosts,
    burnByMonth,
    headcountByMonth,
  }
}
