import { SCENARIO_ORDER, defaultState, newId } from '../calc/defaults'
import type {
  AppState,
  CompanyInputs,
  ExpenseLine,
  Founder,
  Hire,
  Investor,
  OptionPool,
  SafeTerms,
  ScenarioId,
  ScenarioInputs,
} from '../calc/types'

export const STORAGE_KEY = 'fundraising-calculator.v1'

/**
 * Reading a saved plan back is the one place this tool can lose a founder's work,
 * so nothing here trusts the payload. Every field is rebuilt over the seed state:
 * a plan written by an older build, hand-edited in devtools, or truncated mid-write
 * comes back as a usable plan with the missing parts filled in, rather than
 * throwing during the first render and leaving a blank page that survives reloads.
 */

type Unknown = Record<string, unknown>

function isObject(value: unknown): value is Unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function rows<T>(value: unknown, read: (row: Unknown, index: number) => T): T[] | null {
  if (!Array.isArray(value)) return null
  return value.filter(isObject).map((row, index) => read(row, index))
}

function readFounder(row: Unknown, index: number): Founder {
  return {
    id: str(row.id, newId('founder')),
    name: str(row.name, `Founder ${index + 1}`),
    equityShare: num(row.equityShare, 0),
    annualSalary: num(row.annualSalary, 0),
    benefitsRate: num(row.benefitsRate, 0),
  }
}

function readExpense(row: Unknown): ExpenseLine {
  return {
    id: str(row.id, newId('exp')),
    name: str(row.name, ''),
    monthlyCost: num(row.monthlyCost, 0),
  }
}

function readHire(row: Unknown): Hire {
  return {
    id: str(row.id, newId('hire')),
    role: str(row.role, ''),
    headcount: num(row.headcount, 1),
    annualSalary: num(row.annualSalary, 0),
    startMonth: num(row.startMonth, 1),
  }
}

function readInvestor(row: Unknown, index: number, fallbackCap: number): Investor {
  return {
    id: str(row.id, newId('inv')),
    name: str(row.name, `Investor ${index + 1}`),
    investment: num(row.investment, 0),
    postMoneyCap: num(row.postMoneyCap, fallbackCap),
    discountRate: num(row.discountRate, 0),
  }
}

function readCompany(value: unknown, seed: CompanyInputs): CompanyInputs {
  if (!isObject(value)) return seed
  const founders = rows(value.founders, readFounder) ?? seed.founders
  return {
    founders: founders.length > 0 ? founders : seed.founders,
    expenses: rows(value.expenses, readExpense) ?? seed.expenses,
    payrollLoadRate: num(value.payrollLoadRate, seed.payrollLoadRate),
    currentCash: num(value.currentCash, seed.currentCash),
  }
}

function readSafeTerms(value: unknown, seed: SafeTerms): SafeTerms {
  if (!isObject(value)) return seed
  return {
    safeType: 'post-money',
    postMoneyCap: num(value.postMoneyCap, seed.postMoneyCap),
    discountRate: num(value.discountRate, seed.discountRate),
    mfn: bool(value.mfn, seed.mfn),
    sameTermsForAll: bool(value.sameTermsForAll, seed.sameTermsForAll),
  }
}

function readPool(value: unknown, seed: OptionPool): OptionPool {
  if (!isObject(value)) return seed
  return {
    currentPct: num(value.currentPct, seed.currentPct),
    newPct: num(value.newPct, seed.newPct),
  }
}

function readScenario(value: unknown, seed: ScenarioInputs): ScenarioInputs {
  if (!isObject(value)) return seed
  const safe = readSafeTerms(value.safe, seed.safe)
  const override = value.plannedRaiseOverride
  return {
    id: seed.id,
    label: str(value.label, seed.label),
    blurb: str(value.blurb, seed.blurb),
    targetRunwayMonths: num(value.targetRunwayMonths, seed.targetRunwayMonths),
    bufferMonths: num(value.bufferMonths, seed.bufferMonths),
    hires: rows(value.hires, readHire) ?? seed.hires,
    plannedRaiseOverride:
      typeof override === 'number' && Number.isFinite(override) ? override : null,
    safe,
    investors:
      rows(value.investors, (row, index) => readInvestor(row, index, safe.postMoneyCap)) ??
      seed.investors,
    optionPool: readPool(value.optionPool, seed.optionPool),
  }
}

/** Rebuilds a whole app state from whatever was saved, over the seed defaults. */
export function reviveState(raw: unknown): AppState {
  const seed = defaultState()
  if (!isObject(raw)) return seed

  const scenarios = {} as Record<ScenarioId, ScenarioInputs>
  const saved = isObject(raw.scenarios) ? raw.scenarios : {}
  for (const id of SCENARIO_ORDER) scenarios[id] = readScenario(saved[id], seed.scenarios[id])

  const active = raw.activeScenario
  return {
    company: readCompany(raw.company, seed.company),
    scenarios,
    activeScenario: SCENARIO_ORDER.includes(active as ScenarioId)
      ? (active as ScenarioId)
      : seed.activeScenario,
  }
}

export function loadState(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return reviveState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing, quota, whatever — the tool still works, it just forgets.
  }
}

const PREFS_KEY = 'fundraising-calculator.prefs.v1'

export interface Prefs {
  /** The rules-of-thumb lines. On by default, off for anyone who finds them noise. */
  showBenchmarks: boolean
}

export function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { showBenchmarks: true }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return { showBenchmarks: parsed.showBenchmarks !== false }
  } catch {
    return { showBenchmarks: true }
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // A forgotten preference is not worth a broken page.
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: if we cannot clear it we cannot recover it either.
  }
}
