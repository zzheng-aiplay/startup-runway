import type {
  AppState,
  ExpenseLine,
  Founder,
  Hire,
  Investor,
  ScenarioId,
  ScenarioInputs,
} from './types'

/**
 * Seed state. Tuned so the first screen is internally coherent: the two default cheques
 * add up to exactly the planned raise, the planned raise sits a little above the
 * recommendation (no scary shortfall on load), and every figure lands inside the
 * conventional range the page prints beside it.
 *
 * The 25% loads are not decoration: a US hire costs 25 – 35% above base salary once
 * employer payroll taxes and benefits are in, so a lower default would quietly
 * understate every plan built on it.
 */

/**
 * Row ids have to be unique for the lifetime of a saved plan, not just of a page
 * load: a counter that restarts at 0 while the saved rows keep their old ids hands
 * a new row the id of an existing one, and then editing the new row silently edits
 * the old one too.
 */
export function newId(prefix: string): string {
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${unique}`
}

const founders: Founder[] = [
  { id: 'seed-founder-a', name: 'Founder 1', equityShare: 0.5, annualSalary: 120_000, benefitsRate: 0.25 },
  { id: 'seed-founder-b', name: 'Founder 2', equityShare: 0.5, annualSalary: 120_000, benefitsRate: 0.25 },
]

const expenses: ExpenseLine[] = [
  { id: 'seed-exp-cloud', name: 'Cloud / infrastructure', monthlyCost: 1_200 },
  { id: 'seed-exp-ai', name: 'AI / LLM / API', monthlyCost: 1_500 },
  { id: 'seed-exp-saas', name: 'Software / SaaS', monthlyCost: 600 },
  { id: 'seed-exp-legal', name: 'Legal & accounting', monthlyCost: 1_200 },
  { id: 'seed-exp-insurance', name: 'Insurance', monthlyCost: 350 },
  { id: 'seed-exp-office', name: 'Office / coworking', monthlyCost: 0 },
  { id: 'seed-exp-marketing', name: 'Marketing', monthlyCost: 400 },
  { id: 'seed-exp-travel', name: 'Travel', monthlyCost: 250 },
  { id: 'seed-exp-other', name: 'Other', monthlyCost: 0 },
]

function investorPair(amount: number, cap: number): Investor[] {
  return [
    { id: 'seed-inv-1', name: 'Investor 1', investment: amount, postMoneyCap: cap, discountRate: 0 },
    { id: 'seed-inv-2', name: 'Investor 2', investment: amount, postMoneyCap: cap, discountRate: 0 },
  ]
}

const leanHires: Hire[] = []

const baseHires: Hire[] = [
  { id: 'seed-hire-fe', role: 'Founding Engineer', headcount: 1, annualSalary: 150_000, startMonth: 4 },
  { id: 'seed-hire-eng', role: 'Engineer', headcount: 1, annualSalary: 150_000, startMonth: 14 },
]

const aggressiveHires: Hire[] = [
  { id: 'seed-hire-fe-a', role: 'Founding Engineer', headcount: 1, annualSalary: 160_000, startMonth: 2 },
  { id: 'seed-hire-eng-a', role: 'Engineer', headcount: 2, annualSalary: 150_000, startMonth: 6 },
  { id: 'seed-hire-design-a', role: 'Designer', headcount: 1, annualSalary: 140_000, startMonth: 10 },
]

function scenario(
  id: ScenarioId,
  label: string,
  blurb: string,
  targetRunwayMonths: number,
  hires: Hire[],
  plannedRaiseOverride: number | null,
  cap: number,
  checkSize: number,
): ScenarioInputs {
  return {
    id,
    label,
    blurb,
    targetRunwayMonths,
    bufferMonths: 3,
    hires,
    plannedRaiseOverride,
    safe: {
      safeType: 'post-money',
      postMoneyCap: cap,
      discountRate: 0,
      mfn: false,
      sameTermsForAll: true,
    },
    investors: investorPair(checkSize, cap),
    optionPool: { currentPct: 0, newPct: 0 },
  }
}

export function defaultState(): AppState {
  return {
    company: {
      founders: founders.map((f) => ({ ...f })),
      expenses: expenses.map((e) => ({ ...e })),
      payrollLoadRate: 0.25,
      currentCash: 0,
    },
    scenarios: {
      lean: scenario(
        'lean',
        'Lean',
        'No hires, 18-month target.',
        18,
        leanHires,
        650_000,
        8_000_000,
        325_000,
      ),
      base: scenario(
        'base',
        'Base',
        'Two engineers over 18 months.',
        18,
        baseHires.map((h) => ({ ...h })),
        1_050_000,
        8_000_000,
        525_000,
      ),
      aggressive: scenario(
        'aggressive',
        'Aggressive',
        'Four hires, 24-month target.',
        24,
        aggressiveHires.map((h) => ({ ...h })),
        2_240_000,
        12_000_000,
        1_120_000,
      ),
    },
    activeScenario: 'base',
  }
}

export const SCENARIO_ORDER: ScenarioId[] = ['lean', 'base', 'aggressive']

/** Blank rows for the add buttons. */
export function blankExpense(): ExpenseLine {
  return { id: newId('exp'), name: '', monthlyCost: 0 }
}

export function blankHire(startMonth: number): Hire {
  return { id: newId('hire'), role: '', headcount: 1, annualSalary: 150_000, startMonth }
}

export function blankInvestor(index: number, cap: number, discountRate: number): Investor {
  return {
    id: newId('inv'),
    name: `Investor ${index}`,
    investment: 250_000,
    postMoneyCap: cap,
    discountRate,
  }
}

export function blankFounder(index: number): Founder {
  return {
    id: newId('founder'),
    name: `Founder ${index}`,
    equityShare: 0,
    annualSalary: 120_000,
    benefitsRate: 0.25,
  }
}
