import { useEffect, useRef, useState } from 'react'
import { formatMoneyCompact, formatMonthsShort, formatPct } from '../calc/format'
import type { ModelResults } from '../calc/types'

const HEADLINE = 'How much should we raise?'

/**
 * Headline, scenario tabs, and the condensed answer that follows you down the page.
 *
 * There used to be a three-number answer strip and a plain-English sentence here.
 * Both restated the four stat cells in the rail, which sit at the same height and
 * stay put while you scroll — so the page said the same thing twice before asking
 * a single question. The sticky bar stays, because the rail is *not* sticky below
 * 900px and that is where the answer would otherwise scroll away.
 */
export function PageHeader({
  results,
  tabs,
}: {
  results: ModelResults
  tabs: React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 pb-7">
        {/* basis, not flex-1: with a 0 flex-base the row never wraps and the headline
            gets crushed to a few pixels beside the tabs on a phone. */}
        <h1 className="t-headline grow basis-[24ch] min-w-[17rem]" style={{ maxWidth: '30ch' }}>
          {HEADLINE}
        </h1>
        {tabs}
      </div>

      <div style={{ borderTop: '1px solid var(--color-rule)' }} />

      <StickyAnswer results={results} />
    </div>
  )
}

/**
 * The answer follows you down the page in a 40px condensed form. It earns its keep
 * below 900px, where the results rail is static and scrolls out of sight.
 */
function StickyAnswer({ results }: { results: ModelResults }) {
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
      {/* On a phone the three values fit but their labels do not, and a clipped
          dilution figure is worse than an unlabelled one. */}
      <span className="t-th hidden md:inline">{label}</span>
      <span className="num text-[17px] font-medium text-ink-900">{value}</span>
    </span>
  )
}
