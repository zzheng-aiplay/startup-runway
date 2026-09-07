import { SCENARIO_ORDER, defaultState } from '../calc/defaults'
import type { AppState, ScenarioId, ScenarioInputs } from '../calc/types'
import { reviveState } from './persist'

/* ==========================================================================
   Saving and sharing a plan without a server.

   A plan is packed into a compact array, base64url-encoded, and carried in the
   URL *fragment*. The fragment is the important part: browsers never send it to
   the server, so a shared plan never touches this site's host, its logs, or any
   third party. There is no account, no database, and no network request — which
   is a claim anyone can check by reading this file.

   What that means in practice: a plan link is exactly as private as the place you
   paste it. It is also in your browser history. Nothing here is encrypted,
   because the alternative is key management, and burn numbers are not worth it.

   Decoding runs everything through reviveState(), the same validator the saved
   plan uses, so a hostile or truncated payload degrades to the default plan
   rather than reaching the engine. Values are numbers; names are strings that
   React escapes on render and that are length-capped below.
   ========================================================================== */

/** Bump when the packed shape changes so old links fail cleanly instead of oddly. */
const FORMAT = 1

/** Long enough for a real plan, short enough to paste into a chat window. */
export const MAX_LINK_LENGTH = 1800

/** Names are display strings; a very long one is either a mistake or an attack. */
const MAX_NAME = 60

type Packed = unknown[]

function round(value: number, dp = 6): number {
  if (!Number.isFinite(value)) return 0
  const f = 10 ** dp
  return Math.round(value * f) / f
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_NAME) : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function packScenario(s: ScenarioInputs): Packed {
  return [
    s.targetRunwayMonths,
    s.bufferMonths,
    s.plannedRaiseOverride,
    [s.safe.postMoneyCap, round(s.safe.discountRate), s.safe.mfn ? 1 : 0, s.safe.sameTermsForAll ? 1 : 0],
    [round(s.optionPool.currentPct), round(s.optionPool.newPct)],
    s.hires.map((h) => [h.role, h.headcount, h.annualSalary, h.startMonth]),
    s.investors.map((i) => [i.name, i.investment, i.postMoneyCap, round(i.discountRate)]),
  ]
}

/**
 * Ids, labels and blurbs are deliberately left out — they are either regenerated
 * or come from the seed, and they are the bulkiest part of the state.
 */
export function packPlan(state: AppState): Packed {
  return [
    FORMAT,
    SCENARIO_ORDER.indexOf(state.activeScenario),
    [round(state.company.payrollLoadRate), state.company.currentCash],
    state.company.founders.map((f) => [f.name, round(f.equityShare), f.annualSalary, round(f.benefitsRate)]),
    state.company.expenses.map((e) => [e.name, e.monthlyCost]),
    SCENARIO_ORDER.map((id) => packScenario(state.scenarios[id])),
  ]
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): string {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodePlan(state: AppState): string {
  return toBase64Url(JSON.stringify(packPlan(state)))
}

/** Rebuilds a state-shaped object from a packed plan, for reviveState to validate. */
function unpack(packed: unknown): unknown {
  if (!Array.isArray(packed) || packed[0] !== FORMAT) return null
  const [, activeIndex, companyScalars, founders, expenses, scenarios] = packed
  const seed = defaultState()

  const scalars = Array.isArray(companyScalars) ? companyScalars : []
  const packedScenarios = Array.isArray(scenarios) ? scenarios : []

  const revivedScenarios: Record<string, unknown> = {}
  SCENARIO_ORDER.forEach((id: ScenarioId, index) => {
    const row = packedScenarios[index]
    if (!Array.isArray(row)) return
    const [target, buffer, override, safe, pool, hires, investors] = row
    const safeRow = Array.isArray(safe) ? safe : []
    const poolRow = Array.isArray(pool) ? pool : []
    revivedScenarios[id] = {
      targetRunwayMonths: num(target),
      bufferMonths: num(buffer),
      plannedRaiseOverride: typeof override === 'number' ? override : null,
      safe: {
        postMoneyCap: num(safeRow[0]),
        discountRate: num(safeRow[1]),
        mfn: safeRow[2] === 1,
        sameTermsForAll: safeRow[3] === 1,
      },
      optionPool: { currentPct: num(poolRow[0]), newPct: num(poolRow[1]) },
      hires: (Array.isArray(hires) ? hires : []).filter(Array.isArray).map((h) => ({
        role: text(h[0]),
        headcount: num(h[1]),
        annualSalary: num(h[2]),
        startMonth: num(h[3]),
      })),
      investors: (Array.isArray(investors) ? investors : []).filter(Array.isArray).map((i) => ({
        name: text(i[0]),
        investment: num(i[1]),
        postMoneyCap: num(i[2]),
        discountRate: num(i[3]),
      })),
    }
  })

  return {
    company: {
      payrollLoadRate: num(scalars[0]),
      currentCash: num(scalars[1]),
      founders: (Array.isArray(founders) ? founders : []).filter(Array.isArray).map((f) => ({
        name: text(f[0]),
        equityShare: num(f[1]),
        annualSalary: num(f[2]),
        benefitsRate: num(f[3]),
      })),
      expenses: (Array.isArray(expenses) ? expenses : []).filter(Array.isArray).map((e) => ({
        name: text(e[0]),
        monthlyCost: num(e[1]),
      })),
    },
    scenarios: revivedScenarios,
    activeScenario:
      typeof activeIndex === 'number' ? SCENARIO_ORDER[activeIndex] : seed.activeScenario,
  }
}

/** Validates a packed plan array — shared by the link and the file reader. */
export function decodePlanArray(packed: unknown): AppState | null {
  const unpacked = unpack(packed)
  return unpacked ? reviveState(unpacked) : null
}

/** null when the token is not a plan at all. Anything malformed inside it is repaired. */
export function decodePlan(token: string): AppState | null {
  try {
    return decodePlanArray(JSON.parse(fromBase64Url(token)))
  } catch {
    return null
  }
}

/** The full link, for the copy button. */
export function planLink(state: AppState): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#plan=${encodePlan(state)}`
}

/** Reads a plan out of the current URL, if there is one. */
export function planFromLocation(): AppState | null {
  const match = /[#&]plan=([A-Za-z0-9\-_]+)/.exec(window.location.hash)
  return match ? decodePlan(match[1]) : null
}

/**
 * A shared plan must not be re-applied on every refresh — it would overwrite
 * whatever the reader typed after opening it — so the token comes out of the URL
 * once it has been adopted.
 */
export function clearPlanFromLocation(): void {
  if (!window.location.hash.includes('plan=')) return
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}
