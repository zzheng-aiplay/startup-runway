import { useEffect, useRef, useState } from 'react'
import {
  formatMoney,
  formatMoneyCompact,
  formatMonths,
  formatMonthsShort,
  formatPct,
} from '../calc/format'
import { founderPhrase, togetherIfPlural } from '../copy/people'
import type { ModelResults } from '../calc/types'
import { InfoTip, type GlossaryMap } from './primitives'

const HEADLINE = 'How much should we raise, and how much of the company will it cost?'

/**
 * The answer, before any scrolling: raise → runway → what it costs you, then the
 * same thing said once in a sentence. Three numbers state the causal chain
 * typographically; the sentence is what makes it a memo rather than a dashboard.
 */
export function AnswerStrip({
  results,
  glossary,
  tabs,
}: {
  results: ModelResults
  glossary: GlossaryMap
  tabs: React.ReactNode
}) {
  const { capital, runway, safe, gates } = results
  // The headline dilution is a block-level number: it does not depend on how the two
  // of them split their own stake, so a split mid-edit must not blank it.
  const ownershipOk = gates.blockOwnershipComputable
  const target = results.inputs.scenario.targetRunwayMonths

  const raiseSub = capital.isOverridden
    ? capital.raiseGap < -1
      ? `${formatMoney(Math.abs(capital.raiseGap))} below the recommended ${formatMoney(capital.recommendedRaise)}`
      : `recommended ${formatMoney(capital.recommendedRaise)}`
    : `covers ${target} months + ${Math.max(0, Math.round(results.inputs.scenario.bufferMonths))} months of buffer`

  const noRaiseRunway = runway.withoutRaise
  const runwaySub =
    capital.plannedRaise > 0
      ? `${formatMonthsShort(noRaiseRunway)} without a raise`
      : `no raise modelled — this is the cash you have`

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

      <div className="pt-7 flex flex-wrap items-start gap-y-6" style={{ columnGap: 24 }}>
        <AnswerField
          label="Raise"
          value={formatMoney(capital.plannedRaise)}
          sub={raiseSub}
          tip={glossary.plannedRaise}
        />
        <Arrow />
        <AnswerField
          label="Runway"
          value={
            Number.isFinite(runway.withRaise)
              ? formatMonths(runway.withRaise).replace(/ months?$/, '')
              : '—'
          }
          unit={Number.isFinite(runway.withRaise) ? 'mo' : undefined}
          sub={runwaySub}
          subTone={noRaiseRunway < 3 ? 'alarm' : 'default'}
          tip={glossary.runway}
        />
        <Arrow />
        <AnswerField
          label="Founder dilution"
          value={ownershipOk ? formatPct(safe.founderDilution, 1) : '—'}
          sub={
            ownershipOk
              ? `you keep ${formatPct(safe.founderBlockAfter, 1)}${
                  safe.poolPostRoundPct > 0
                    ? ` · pool ${formatPct(safe.poolPostRoundPct, 1)}`
                    : ''
                }`
              : 'fix the inputs flagged below'
          }
          subTone={ownershipOk ? 'default' : 'error'}
          tip={glossary.dilution}
        />
      </div>

      <p className="t-body num mt-6 pb-7">{plainSentence(results)}</p>

      <div style={{ borderTop: '1px solid var(--color-hairline)' }} />

      <StickyAnswer results={results} />
    </div>
  )
}

function Arrow() {
  return (
    <span aria-hidden className="text-ink-300 text-base self-start hidden sm:block" style={{ lineHeight: '56px' }}>
      →
    </span>
  )
}

function AnswerField({
  label,
  value,
  unit,
  sub,
  subTone = 'default',
  tip,
}: {
  label: string
  value: string
  unit?: string
  sub: string
  subTone?: 'default' | 'alarm' | 'error'
  tip?: { term: string; definition: string; yours?: string }
}) {
  return (
    <div>
      <div className="t-answer-label flex items-center mb-2">
        {label}
        {tip && <InfoTip {...tip} />}
      </div>
      <div>
        <span className="t-answer-value num">{value}</span>
        {unit && <span className="t-answer-unit num">{unit}</span>}
      </div>
      <div
        className="t-answer-sub num mt-1.5"
        style={
          subTone === 'alarm'
            ? { color: 'var(--color-cash-out)' }
            : subTone === 'error'
              ? { color: 'var(--color-danger-ink)' }
              : undefined
        }
      >
        {sub}
      </div>
    </div>
  )
}

/** One sentence that fuses the three numbers into a single claim. */
function plainSentence(results: ModelResults): string {
  const { capital, runway, safe, gates } = results
  const raise = formatMoney(capital.plannedRaise)
  const months = Number.isFinite(runway.withRaise)
    ? formatMonths(runway.withRaise)
    : 'an unlimited runway'

  if (capital.plannedRaise <= 0) {
    return `With no raise you have ${months} of cash. The recommended raise for your plan is ${formatMoney(capital.recommendedRaise)}.`
  }
  if (!gates.ownershipComputable) {
    return `Raising ${raise} keeps you running ${months}. Ownership is on hold until the inputs flagged below are fixed.`
  }

  const split = safe.founderRows
    .filter((f) => f.after > 0)
    .map((f) => `${f.name || 'Founder'} ${formatPct(f.after, 1)}`)
    .join(' · ')

  const who = founderPhrase(safe.founderRows.length)
  const together = togetherIfPlural(safe.founderRows.length)
  return `Raising ${raise} keeps you running ${months} and costs ${who} ${formatPct(safe.founderDilution, 1)} of the company. You would still own ${formatPct(safe.founderBlockAfter, 1)}${together}${split ? ` — ${split}` : ''}.`
}

/**
 * The page is long and the strip scrolls away, so the answer follows you down in
 * a 40px condensed form. Paper, one hairline, no glass.
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
