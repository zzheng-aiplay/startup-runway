import { useEffect, useRef, useState } from 'react'
import { formatMoneyCompact, formatMonthsShort, formatPct } from '../calc/format'
import type { ModelResults } from '../calc/types'

/**
 * The answer, condensed, following you down as you work through the steps.
 *
 * Its sentinel sits at the top of the inputs pane rather than at the top of the
 * page, because the pane is what scrolls while you are actually filling the form —
 * so the bar arrives when the numbers leave, not several screens later.
 *
 * Paper at 94%, one hairline, no blur and no shadow. On a phone the labels go and
 * the three values stay: a clipped dilution figure is worse than an unlabelled one.
 */
export function StickyAnswer({ results }: { results: ModelResults }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      threshold: 0,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const { capital, runway, safe, gates } = results

  return (
    <>
      <div ref={sentinel} aria-hidden style={{ height: 1, marginTop: -1 }} />
      {stuck && (
        <div className="sticky-answer" aria-hidden>
          <div className="page flex items-baseline gap-3 md:gap-5" style={{ paddingBlock: 0 }}>
            <Condensed label="Raise" value={formatMoneyCompact(capital.plannedRaise)} />
            <span className="text-ink-300">→</span>
            <Condensed
              label="Runway"
              value={Number.isFinite(runway.withRaise) ? formatMonthsShort(runway.withRaise) : '—'}
            />
            <span className="text-ink-300">→</span>
            <Condensed
              label="Dilution"
              value={gates.blockOwnershipComputable ? formatPct(safe.founderDilution, 1) : '—'}
            />
            <span className="t-caption ml-auto hidden md:block">
              {results.inputs.scenario.label}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

function Condensed({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="t-th hidden md:inline">{label}</span>
      <span className="num text-[17px] font-medium text-ink-900">{value}</span>
    </span>
  )
}
