import type { CapTableRow, HolderKind } from '../calc/types'

/**
 * Semantic colour is rationed on purpose: it appears in the cap-table keys, the
 * ownership bar, and the chart — nowhere else. Ordinary dilution is never
 * alarm-coloured; red is reserved for cash going negative and for real errors.
 */
export const COLORS = {
  founders: '#2C4A7C',
  // Dark enough that a white 11px label inside the segment clears 4.5:1.
  founders2: '#46628F',
  investors: '#1F6F6B',
  investors2: '#4E9A94',
  pool: '#8E9AA8',
  accent: '#2C4A7C',
  cashOut: '#9C3B2E',
  ink100: '#EDEAE5',
  ink200: '#DCD8D1',
  ink300: '#C2BDB4',
  ink500: '#736D62',
  ink600: '#5C564D',
  ink900: '#17150F',
  rule: '#D5D0C8',
  ruleStrong: '#A8A29A',
  paper: '#FCFBF9',
  surface: '#FFFFFF',
} as const

/** Founders and investors alternate between two tints of their own hue. */
export function holderColor(kind: HolderKind, indexWithinKind: number): string {
  if (kind === 'pool') return COLORS.pool
  if (kind === 'founder') return indexWithinKind % 2 === 0 ? COLORS.founders : COLORS.founders2
  return indexWithinKind % 2 === 0 ? COLORS.investors : COLORS.investors2
}

/** Assigns each cap-table row its key colour in one pass. */
export function withColors(rows: CapTableRow[]): (CapTableRow & { color: string })[] {
  const seen: Record<HolderKind, number> = { founder: 0, investor: 0, pool: 0 }
  return rows.map((row) => {
    const color = holderColor(row.kind, seen[row.kind])
    seen[row.kind] += 1
    return { ...row, color }
  })
}
