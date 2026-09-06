/** Small numeric helpers shared by the engine. Pure, no domain knowledge. */

/** Cash comparisons tolerate float residue at the sub-cent level. */
export const CASH_EPSILON = 1e-6

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Any non-finite or negative input becomes 0. Used on every money input. */
export function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Integer >= 1. Used on hire start months and headcounts. */
export function positiveInt(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.round(value))
}

export function sum(values: number[]): number {
  let total = 0
  for (const v of values) total += v
  return total
}

/** Division that returns 0 instead of Infinity/NaN when the denominator is unusable. */
export function safeDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0
  return numerator / denominator
}

export function nearlyEqual(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance
}

/**
 * Largest-remainder rounding: round every share to `digits` decimals of a percentage
 * so the displayed column still totals exactly `total` (default 100).
 *
 * Input is decimals (0.4375), output is percentages (43.75) — because the whole point
 * is to hand the UI numbers it can print without re-rounding them.
 */
export function roundSharesToTotal(shares: number[], digits = 2, total = 100): number[] {
  if (shares.length === 0) return []
  const scale = 10 ** digits
  const targetUnits = Math.round(total * scale)
  const raw = shares.map((s) => s * 100 * scale)
  const floors = raw.map((r) => Math.floor(r))
  let deficit = targetUnits - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, remainder: r - Math.floor(r) }))
    .sort((a, b) => b.remainder - a.remainder)
  const units = [...floors]
  // Hand out the leftover units to the biggest remainders (or claw back, if negative).
  for (let k = 0; deficit > 0 && order.length > 0; k++, deficit--) {
    units[order[k % order.length].i] += 1
  }
  for (let k = 0; deficit < 0 && order.length > 0; k++, deficit++) {
    units[order[order.length - 1 - (k % order.length)].i] -= 1
  }
  return units.map((u) => u / scale)
}
