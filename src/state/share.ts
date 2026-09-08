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

/**
 * Transport markers, prefixed to the token. `~` is outside the base64url alphabet,
 * so a marker can never be mistaken for payload — and a token with no marker at all
 * is a link shared before compression existed, which still decodes.
 */
const RAW = '~1'
const DEFLATED = '~2'

/** A name equal to the seed's travels as this instead of as itself. */
const SEED_NAME = 0

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

/**
 * Most plans keep the seeded labels — nine expense lines alone are 250 bytes of
 * "Cloud / infrastructure" and friends. Anything still equal to the seed travels as
 * a single 0 and is read back from the seed on the other side.
 *
 * The trade-off, stated plainly: if a future build renames a default, an old link
 * shows the new label. Only labels can drift this way, never numbers.
 */
function packName(name: string, seed: string | undefined): string | number {
  return name === seed ? SEED_NAME : name
}

function readName(value: unknown, seed: string | undefined, fallback: string): string {
  if (value === SEED_NAME) return seed ?? fallback
  return typeof value === 'string' ? value.slice(0, MAX_NAME) : fallback
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function packScenario(s: ScenarioInputs, seed: ScenarioInputs): Packed {
  return [
    s.targetRunwayMonths,
    s.bufferMonths,
    s.plannedRaiseOverride,
    [s.safe.postMoneyCap, round(s.safe.discountRate), s.safe.mfn ? 1 : 0, s.safe.sameTermsForAll ? 1 : 0],
    [round(s.optionPool.currentPct), round(s.optionPool.newPct)],
    s.hires.map((h, i) => [packName(h.role, seed.hires[i]?.role), h.headcount, h.annualSalary, h.startMonth]),
    s.investors.map((inv, i) => [
      packName(inv.name, seed.investors[i]?.name),
      inv.investment,
      inv.postMoneyCap,
      round(inv.discountRate),
    ]),
  ]
}

/**
 * Ids, labels and blurbs are deliberately left out — they are either regenerated
 * or come from the seed, and they are the bulkiest part of the state.
 */
export function packPlan(state: AppState): Packed {
  const seed = defaultState()
  return [
    FORMAT,
    SCENARIO_ORDER.indexOf(state.activeScenario),
    [round(state.company.payrollLoadRate), state.company.currentCash],
    state.company.founders.map((f, i) => [
      packName(f.name, seed.company.founders[i]?.name),
      round(f.equityShare),
      f.annualSalary,
      round(f.benefitsRate),
    ]),
    state.company.expenses.map((e, i) => [
      packName(e.name, seed.company.expenses[i]?.name),
      e.monthlyCost,
    ]),
    SCENARIO_ORDER.map((id) => packScenario(state.scenarios[id], seed.scenarios[id])),
  ]
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): Uint8Array {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Deflate before base64. JSON of a plan is mostly repeated digits and punctuation,
 * which compresses by about 60% — and the base64 that follows costs a third of
 * whatever is left, so the compression is the difference between a link that fits
 * in a sentence and one that does not.
 */
export async function encodePlan(state: AppState): Promise<string> {
  const json = JSON.stringify(packPlan(state))
  const bytes = new TextEncoder().encode(json)
  if (typeof CompressionStream === 'undefined') return RAW + toBase64Url(bytes)
  try {
    return DEFLATED + toBase64Url(await deflate(bytes))
  } catch {
    return RAW + toBase64Url(bytes)
  }
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
      hires: (Array.isArray(hires) ? hires : []).filter(Array.isArray).map((h, i) => ({
        role: readName(h[0], seed.scenarios[id].hires[i]?.role, ''),
        headcount: num(h[1]),
        annualSalary: num(h[2]),
        startMonth: num(h[3]),
      })),
      investors: (Array.isArray(investors) ? investors : []).filter(Array.isArray).map((inv, i) => ({
        name: readName(inv[0], seed.scenarios[id].investors[i]?.name, `Investor ${i + 1}`),
        investment: num(inv[1]),
        postMoneyCap: num(inv[2]),
        discountRate: num(inv[3]),
      })),
    }
  })

  return {
    company: {
      payrollLoadRate: num(scalars[0]),
      currentCash: num(scalars[1]),
      founders: (Array.isArray(founders) ? founders : []).filter(Array.isArray).map((f, i) => ({
        name: readName(f[0], seed.company.founders[i]?.name, `Founder ${i + 1}`),
        equityShare: num(f[1]),
        annualSalary: num(f[2]),
        benefitsRate: num(f[3]),
      })),
      expenses: (Array.isArray(expenses) ? expenses : []).filter(Array.isArray).map((e, i) => ({
        name: readName(e[0], seed.company.expenses[i]?.name, ''),
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
export async function decodePlan(token: string): Promise<AppState | null> {
  try {
    const marker = token.startsWith('~') ? token.slice(0, 2) : ''
    const payload = fromBase64Url(marker ? token.slice(2) : token)
    // No marker means a link shared before compression existed.
    const json = marker === DEFLATED ? await inflate(payload) : payload
    return decodePlanArray(JSON.parse(new TextDecoder().decode(json)))
  } catch {
    return null
  }
}

/** The full link, for the copy button. */
export async function planLink(state: AppState): Promise<string> {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#plan=${await encodePlan(state)}`
}

/** Reads a plan out of the current URL, if there is one. */
export async function planFromLocation(): Promise<AppState | null> {
  const match = /[#&]plan=(~?[A-Za-z0-9\-_]+)/.exec(window.location.hash)
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
