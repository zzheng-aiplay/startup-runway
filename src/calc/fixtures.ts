import type {
  CompanyInputs,
  Founder,
  Investor,
  ScenarioInputs,
} from './types'

/**
 * Test fixtures. The base company burns exactly $100,000/month with nothing else moving,
 * which is the shape the brief's worked examples assume.
 */

export function founder(overrides: Partial<Founder> = {}): Founder {
  return {
    id: 'f1',
    name: 'Founder 1',
    equityShare: 0.5,
    annualSalary: 600_000,
    benefitsRate: 0,
    ...overrides,
  }
}

export function company(overrides: Partial<CompanyInputs> = {}): CompanyInputs {
  return {
    founders: [
      founder({ id: 'f1', name: 'Founder 1' }),
      founder({ id: 'f2', name: 'Founder 2' }),
    ],
    expenses: [],
    payrollLoadRate: 0,
    currentCash: 0,
    ...overrides,
  }
}

export function investor(overrides: Partial<Investor> = {}): Investor {
  return {
    id: 'i1',
    name: 'Investor 1',
    investment: 500_000,
    postMoneyCap: 8_000_000,
    discountRate: 0,
    ...overrides,
  }
}

export function scenario(overrides: Partial<ScenarioInputs> = {}): ScenarioInputs {
  return {
    id: 'base',
    label: 'Base',
    blurb: '',
    targetRunwayMonths: 18,
    bufferMonths: 0,
    hires: [],
    plannedRaiseOverride: null,
    safe: {
      safeType: 'post-money',
      postMoneyCap: 8_000_000,
      discountRate: 0,
      mfn: false,
      sameTermsForAll: true,
    },
    investors: [],
    optionPool: { currentPct: 0, newPct: 0 },
    ...overrides,
  }
}
