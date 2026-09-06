import { useRef } from 'react'
import { formatMoneyCompact } from '../calc/format'
import type { ScenarioId, ScenarioSummary } from '../calc/types'
import { InfoTip, type Glossary } from './primitives'

/**
 * A rail, not pills. Switching a scenario swaps every result but never touches
 * what the reader typed — the caption says so, because otherwise nobody clicks.
 */
export function ScenarioTabs({
  rows,
  activeId,
  onSelect,
  tip,
}: {
  rows: ScenarioSummary[]
  activeId: ScenarioId
  onSelect: (id: ScenarioId) => void
  tip?: Glossary
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys have to move focus as well as selection, or a keyboard user changes
  // the whole plan while the ring stays on the tab they think they are still on.
  const go = (index: number) => {
    const next = rows[(index + rows.length) % rows.length]
    if (!next) return
    onSelect(next.id)
    buttons.current[(index + rows.length) % rows.length]?.focus()
  }
  const move = (delta: number) => go(rows.findIndex((r) => r.id === activeId) + delta)

  return (
    <div className="shrink-0">
      {/* A group of toggles, not a tablist: the numbers a scenario governs are spread
          across the page rather than in one panel, so promising a tabpanel would
          leave a screen-reader user with nothing to move to. */}
      <div
        role="group"
        aria-label="Fundraising scenario"
        className="flex gap-7"
        style={{ borderBottom: '1px solid var(--color-rule)' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            move(1)
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            move(-1)
          }
          if (e.key === 'Home') {
            e.preventDefault()
            go(0)
          }
          if (e.key === 'End') {
            e.preventDefault()
            go(rows.length - 1)
          }
        }}
      >
        {rows.map((row, index) => {
          const active = row.id === activeId
          return (
            <button
              key={row.id}
              type="button"
              ref={(node) => {
                buttons.current[index] = node
              }}
              aria-pressed={active}
              className="tab"
              onClick={() => onSelect(row.id)}
            >
              <span
                className="block text-[13px] leading-[18px] font-medium"
                style={{ color: active ? 'var(--color-ink-900)' : 'var(--color-ink-500)' }}
              >
                {row.label}
              </span>
              <span
                className="num block text-[11px] leading-[14px]"
                style={{ color: active ? 'var(--color-accent)' : 'var(--color-ink-400)' }}
              >
                {formatMoneyCompact(row.plannedRaise)}
              </span>
            </button>
          )
        })}
      </div>
      <p className="t-caption mt-2 max-w-[38ch]">
        A scenario holds its own hiring plan, target runway, raise and SAFE terms. Your founders,
        salaries, payroll load, operating costs and cash in the bank carry across all three.
        {tip && <InfoTip {...tip} />}
      </p>
    </div>
  )
}
