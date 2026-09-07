import type { CapTableRow, HolderKind } from '../calc/types'

/**
 * Semantic colour is rationed on purpose: it appears in the cap-table keys, the
 * ownership bar, and the chart — nowhere else. Ordinary dilution is never
 * alarm-coloured; red is reserved for cash going negative and for real errors.
 *
 * These are `var()` references rather than hex so the SVG in the chart and the
 * swatches beside it follow the light or dark theme along with everything else.
 * SVG presentation attributes resolve custom properties, so Recharts takes them
 * as-is for stroke, fill and tick colours.
 */
export const COLORS = {
  founders: 'var(--color-founders)',
  founders2: 'var(--color-founders-2)',
  investors: 'var(--color-investors)',
  investors2: 'var(--color-investors-2)',
  pool: 'var(--color-pool)',
  /**
   * Burn is one thing in three parts, so it gets one hue in three steps rather than
   * three hues — which also keeps it out of the ownership legend's vocabulary.
   */
  expenseFounders: 'var(--color-expense-founders)',
  expenseHires: 'var(--color-expense-hires)',
  expenseOperating: 'var(--color-expense-operating)',
  accent: 'var(--color-accent)',
  cashOut: 'var(--color-cash-out)',
  ink100: 'var(--color-ink-100)',
  ink200: 'var(--color-ink-200)',
  ink300: 'var(--color-ink-300)',
  ink500: 'var(--color-ink-500)',
  ink600: 'var(--color-ink-600)',
  ink900: 'var(--color-ink-900)',
  rule: 'var(--color-rule)',
  ruleStrong: 'var(--color-rule-strong)',
  paper: 'var(--color-paper)',
  surface: 'var(--color-surface)',
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
