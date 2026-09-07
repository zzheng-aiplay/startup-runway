/**
 * The whole domain, in one file. Everything downstream (engine + UI) speaks these types.
 *
 * Conventions, enforced everywhere:
 *  - money  : plain number of dollars (12500 === $12,500)
 *  - rates  : decimals (0.0625 === 6.25%)
 *  - months : 1-indexed. Month 1 is the first month after the money lands.
 *
 * The engine is the only thing that computes. No component derives a number locally —
 * if the UI needs it, it is a field on ModelResults.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface Founder {
  id: string
  name: string
  /**
   * Share of the *founder block*, not of the company. All founders must sum to 1.
   * With an existing option pool of 10%, a 0.5 share is 45% of the company.
   */
  equityShare: number
  annualSalary: number
  /** Benefits + payroll tax as a multiplier on top of this founder's salary. */
  benefitsRate: number
}

export interface ExpenseLine {
  id: string
  name: string
  monthlyCost: number
}

export interface Hire {
  id: string
  role: string
  headcount: number
  annualSalary: number
  /** 1-indexed month the hire starts costing money. Integer >= 1. */
  startMonth: number
}

export interface Investor {
  id: string
  name: string
  investment: number
  postMoneyCap: number
  /** Modeled as an equivalent lower cap — the worst case for founders. */
  discountRate: number
}

export interface OptionPool {
  /** Pool already reserved today, as % of today's company. */
  currentPct: number
  /** Target *total* pool after the round, as % of the pre-SAFE cap table. */
  newPct: number
}

export interface SafeTerms {
  safeType: 'post-money'
  /** The cap pushed to every investor while sameTermsForAll is on. */
  postMoneyCap: number
  discountRate: number
  /** Informational only. Feeds no number. */
  mfn: boolean
  sameTermsForAll: boolean
}

/** Shared across every scenario — the company is the company. */
export interface CompanyInputs {
  founders: Founder[]
  expenses: ExpenseLine[]
  /** Benefits + payroll tax multiplier applied to non-founder hires. */
  payrollLoadRate: number
  currentCash: number
}

export type ScenarioId = 'lean' | 'base' | 'aggressive'

/** The levers a founder flexes between scenarios. */
export interface ScenarioInputs {
  id: ScenarioId
  label: string
  blurb: string
  targetRunwayMonths: number
  /** Months of forward burn to still hold at the end of the target runway. */
  bufferMonths: number
  hires: Hire[]
  /** null === follow the recommendation. A number === the founder overrode it. */
  plannedRaiseOverride: number | null
  safe: SafeTerms
  investors: Investor[]
  optionPool: OptionPool
}

export interface ModelInputs {
  company: CompanyInputs
  scenario: ScenarioInputs
}

export interface AppState {
  company: CompanyInputs
  scenarios: Record<ScenarioId, ScenarioInputs>
  activeScenario: ScenarioId
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type WarningSeverity = 'error' | 'warn' | 'info'

export type WarningCode =
  | 'founder-split-sum'
  | 'no-founders'
  | 'zero-burn'
  | 'mixed-caps'
  | 'mixed-discounts'
  | 'invalid-cap'
  | 'safe-oversold'
  | 'safe-very-high'
  | 'pool-no-op'
  | 'pool-too-large'
  | 'raise-short'
  | 'raise-over'
  | 'raise-unallocated'
  | 'hire-after-target'
  | 'hire-beyond-horizon'
  | 'discount-modeled'

export type WarningField =
  | 'founders'
  | 'expenses'
  | 'hires'
  | 'cash'
  | 'raise'
  | 'investors'
  | 'pool'

export interface ModelWarning {
  code: WarningCode
  severity: WarningSeverity
  message: string
  field: WarningField
}

// ---------------------------------------------------------------------------
// Burn
// ---------------------------------------------------------------------------

export interface BurnBreakdown {
  founderComp: number
  operating: number
  hireComp: number
  total: number
}

export interface FounderCost {
  id: string
  name: string
  annualSalary: number
  benefitsRate: number
  /** Fully loaded monthly cost. */
  monthlyCost: number
}

export interface HireCost {
  id: string
  role: string
  headcount: number
  annualSalary: number
  startMonth: number
  /** Fully loaded monthly cost once started. */
  monthlyCost: number
  /** startMonth > targetRunwayMonths — only the buffer pays for this one. */
  afterTarget: boolean
  /** startMonth > targetRunwayMonths + bufferMonths — outside the funded horizon. */
  beyondHorizon: boolean
}

export interface BurnResults {
  /** Fully loaded founder comp per month (constant in this model). */
  founderMonthlyComp: number
  /** Sum of the operating expense lines (constant in this model). */
  operatingMonthly: number
  /** Burn in month 1. */
  currentMonthlyBurn: number
  /** Mean of burn over months 1..targetRunwayMonths. */
  averageMonthlyBurn: number
  /** Burn in the final month of the target runway. */
  burnAtEndOfRunway: number
  /** currentMonthlyBurn -> burnAtEndOfRunway as a growth rate. 0 when flat. */
  burnGrowthOverRunway: number
  /** Does any hire start in month 1? (Changes how the burn card is labeled.) */
  hiresInMonthOne: boolean
  breakdown: BurnBreakdown
  founderCosts: FounderCost[]
  hireCosts: HireCost[]
  /** Burn for months 1..horizon. Index 0 === month 1. */
  burnByMonth: number[]
  /** Non-founder headcount by month. Index 0 === month 1. */
  headcountByMonth: number[]
}

// ---------------------------------------------------------------------------
// Capital required
// ---------------------------------------------------------------------------

export interface CapitalResults {
  /** Sum of burn over months 1..N. */
  burnThroughRunway: number
  /** Sum of burn over months N+1..N+B — the cash still in the bank at month N. */
  bufferAmount: number
  /** Total cash the plan consumes through month N+B. */
  cashNeeded: number
  /** max(0, cashNeeded - currentCash) */
  recommendedRaise: number
  /** plannedRaiseOverride ?? recommendedRaise. Drives every downstream number. */
  plannedRaise: number
  isOverridden: boolean
  /** plannedRaise - recommendedRaise. Negative === under-raising. */
  raiseGap: number
  /** Sum of the investor checks on the SAFE list. */
  committedFromInvestors: number
  /** plannedRaise - committedFromInvestors. Non-zero means the two disagree. */
  unallocated: number
}

// ---------------------------------------------------------------------------
// Runway + projection
// ---------------------------------------------------------------------------

export interface MonthPoint {
  /** 1-indexed. */
  month: number
  burn: number
  founderComp: number
  operating: number
  hireComp: number
  /** Cash at the END of this month, having raised the planned amount at month 0. */
  cashWithRaise: number
  /** Cash at the END of this month with no raise at all. */
  cashWithoutRaise: number
  /** Non-founder headcount on payroll this month. */
  headcount: number
}

export interface HireEventGroup {
  month: number
  roles: { role: string; headcount: number }[]
  /** How much monthly burn steps up in this month. */
  monthlyBurnDelta: number
  cumulativeHeadcount: number
  /** '+2 Engineers' for one role, '+3 hires' when a month has several. */
  label: string
  afterTarget: boolean
  beyondHorizon: boolean
}

/** One row of the cash chart. Series are clamped at 0 and null after they die. */
export interface ChartPoint {
  month: number
  cashWithRaise: number | null
  cashNoRaise: number | null
  /** The same plan funded by the recommendation instead. Null when it matches. */
  cashAtRecommended: number | null
  burn: number
}

export interface RunwayResults {
  /** Months of runway with the planned raise. Fractional. Infinity when burn is 0. */
  withRaise: number
  withoutRaise: number
  /** 1-indexed month in which cash first hits or crosses zero, or null. */
  outOfCashMonthWithRaise: number | null
  outOfCashMonthWithoutRaise: number | null
  /** Cash left at the end of the target runway, with the planned raise. */
  cashAtEndOfTargetRunway: number
  /** cashAtEndOfTargetRunway expressed in months of forward burn. */
  bufferMonthsAchieved: number
  /** Does the planned raise reach the target runway? */
  hitsTargetRunway: boolean
  /** Target + buffer — what the recommended raise is scoped to fund. */
  targetPlusBuffer: number
  /** Last month plotted / simulated for display purposes. */
  horizon: number
}

// ---------------------------------------------------------------------------
// SAFE + cap table
// ---------------------------------------------------------------------------

export interface InvestorResult {
  id: string
  name: string
  investment: number
  postMoneyCap: number
  discountRate: number
  /** postMoneyCap * (1 - discountRate) */
  effectiveCap: number
  /** investment / effectiveCap, or 0 when the cap is unusable. */
  ownership: number
  /** Cap missing / zero / negative — ownership cannot be computed. */
  capInvalid: boolean
  /** This one check alone is >= 100% of the company. */
  oversold: boolean
}

export type HolderKind = 'founder' | 'investor' | 'pool'

export interface CapTableRow {
  id: string
  holder: string
  kind: HolderKind
  /** Ownership today (founders + existing pool sum to 1). */
  before: number
  /** Ownership created in this round, or null for holders who get none. */
  newOwnership: number | null
  /** Ownership after the round. Rows sum to 1. */
  after: number
  /** after - before, in percentage points. */
  change: number
}

export interface OwnershipSplit {
  founders: number
  investors: number
  pool: number
}

export interface SafeResults {
  investors: InvestorResult[]
  /** Sum of investor ownership. */
  totalSafeOwnership: number
  /** Pool as % of the pre-SAFE cap table: max(currentPct, newPct). */
  poolPreSafePct: number
  /** Pool after SAFE dilution: poolPreSafePct * (1 - totalSafeOwnership). */
  poolPostRoundPct: number
  /** New pool created out of the pre-round holders, in points: P - currentPct. */
  poolIncrementPct: number
  /** True when newPct <= currentPct, i.e. the new-pool field does nothing. */
  poolIsNoOp: boolean
  /** Founders' combined ownership today: 1 - currentPct. */
  founderBlockBefore: number
  /** Founders' combined ownership after pool creation and SAFE dilution. */
  founderBlockAfter: number
  /** Dilution *of this round*, relative to what the founders own today. */
  founderDilution: number
  /** Points of the company the founder block loses: before - after. */
  dilutionPoints: number
  /** Points lost to creating the new pool: P - currentPct. */
  dilutionPointsFromPool: number
  /** Points lost to the SAFEs: (1 - P) * S. */
  dilutionPointsFromSafes: number
  /** plannedRaise / totalSafeOwnership, or 0 when undefined. */
  impliedPostMoneyValuation: number
  /** Investment-weighted average effective cap. */
  blendedCap: number
  capTable: CapTableRow[]
  before: OwnershipSplit
  after: OwnershipSplit
  /** Every per-founder before/after, for the per-founder callout. */
  founderRows: { id: string; name: string; before: number; after: number }[]
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

export interface ModelGates {
  /** Founder shares sum to 1.00 (±0.0005). */
  founderSplitValid: boolean
  /** At least one investor has an unusable cap. */
  hasInvalidCap: boolean
  /** Total SAFE ownership >= 100% — the round as entered is impossible. */
  safeOversold: boolean
  /** Safe to render per-founder rows: the cap table's founder lines and the bar. */
  ownershipComputable: boolean
  /**
   * Safe to render the block-level numbers — total dilution, what the founders keep
   * between them, the investors' share. None of those depend on how the founders
   * split their own stake, so a split that is mid-edit must not blank them.
   */
  blockOwnershipComputable: boolean
}

// ---------------------------------------------------------------------------
// Top-level result
// ---------------------------------------------------------------------------

export interface ModelResults {
  inputs: ModelInputs
  burn: BurnResults
  capital: CapitalResults
  runway: RunwayResults
  safe: SafeResults
  gates: ModelGates
  /** Months 1..horizon. */
  projection: MonthPoint[]
  /**
   * The cash-balance series, months 0..horizon. Nothing plots it at the moment — the
   * chart in the rail shows monthly spending instead — but it is the model's, not the
   * chart's, and putting the cash picture back is a component away.
   */
  chart: ChartPoint[]
  hireEvents: HireEventGroup[]
  warnings: ModelWarning[]
}

/** One row of the Lean / Base / Aggressive comparison table. */
export interface ScenarioSummary {
  id: ScenarioId
  label: string
  blurb: string
  isActive: boolean
  plannedRaise: number
  recommendedRaise: number
  targetRunwayMonths: number
  bufferMonths: number
  runwayMonths: number
  hitsTargetRunway: boolean
  currentMonthlyBurn: number
  burnAtEndOfRunway: number
  cashNeeded: number
  blendedCap: number
  totalSafeOwnership: number
  /** Points of the company the new pool takes off the existing holders. */
  poolIncrementPoints: number
  /** The pool's share after the round. */
  poolAfterPct: number
  founderDilution: number
  founderBlockAfter: number
  /** False when this scenario's round is impossible — ownership must not be printed. */
  ownershipComputable: boolean
  headcountAtEnd: number
}
