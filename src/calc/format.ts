/**
 * Pure display helpers. No React, no DOM.
 *
 * Money is stored everywhere as a plain number of dollars. Percentages are stored
 * everywhere as decimals (0.0625 === 6.25%). These helpers are the only place that
 * knows how either is written down for a human.
 */

const MONEY_SUFFIXES: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
}

/** `$12,500` — whole dollars, grouped. Negative renders as `-$1,200`. */
export function formatMoney(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

/**
 * `$2.1M`, `$850K`, `$0` — for headline numbers where digits would be noise.
 * Keeps one decimal only when it carries information ($2.1M, but $2M not $2.0M).
 */
export function formatMoneyCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${trimZero(abs / 1_000_000)}M`
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}K`
  if (abs >= 1_000) return `${sign}$${trimZero(abs / 1_000)}K`
  return `${sign}$${Math.round(abs)}`
}

function trimZero(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/**
 * Accepts what founders actually type: `1,200`, `$1200`, `500k`, `1.5M`, `2 m`, ``.
 * Returns null when there is no number in there at all, so callers can leave the
 * field alone mid-edit instead of snapping it to 0.
 */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/[$,\s_]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const match = /^(-?\d*\.?\d*)([kmb])?$/.exec(cleaned)
  if (!match || match[1] === '' || match[1] === '-') return null
  const n = Number(match[1])
  if (!Number.isFinite(n)) return null
  const multiplier = match[2] ? MONEY_SUFFIXES[match[2]] : 1
  return n * multiplier
}

/** `6.25%` from `0.0625`. Trailing zeros are trimmed: 0.5 -> `50%`. */
export function formatPct(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const pct = value * 100
  const rounded = Number(pct.toFixed(maxFractionDigits))
  return `${rounded.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })}%`
}

/** `0.0625` from `6.25`, `6.25%`, ` 6.25 % `. Returns null on nonsense. */
export function parsePct(raw: string): number | null {
  const cleaned = raw.trim().replace(/[%\s,]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return n / 100
}

/** `18 months`, `13.4 months`, `1 month`, `60+ months` past the projection horizon. */
export function formatMonths(months: number, horizon = 120): string {
  if (!Number.isFinite(months)) return 'unlimited'
  if (months >= horizon) return `${horizon}+ months`
  const rounded = Math.round(months * 10) / 10
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${label} ${rounded === 1 ? 'month' : 'months'}`
}

/** A real minus sign, not a hyphen. Used everywhere a number goes negative. */
export const MINUS = '−'

/**
 * Ownership changes are *points*, not percent — `−9.7 pts`. Writing them as
 * `−9.7%` invites reading them as a 9.7% relative haircut, which is the most
 * common cap-table misreading there is.
 */
export function formatPoints(delta: number, maxFractionDigits = 1): string {
  if (!Number.isFinite(delta)) return '—'
  const pts = delta * 100
  const rounded = Number(Math.abs(pts).toFixed(maxFractionDigits))
  const sign = pts < 0 ? MINUS : '+'
  if (rounded === 0) return '0 pts'
  return `${sign}${rounded.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })} pts`
}

/** Chart-axis money: `$1.2M`, `$840K`, `$0`, `−$210K`. */
export function formatAxisMoney(value: number): string {
  const label = formatMoneyCompact(Math.abs(value))
  return value < 0 ? `${MINUS}${label}` : label
}

/** Short form for chart axes and table cells: `18.4 mo`. */
export function formatMonthsShort(months: number, horizon = 120): string {
  if (!Number.isFinite(months)) return '∞'
  if (months >= horizon) return `${horizon}+ mo`
  const rounded = Math.round(months * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} mo`
}
