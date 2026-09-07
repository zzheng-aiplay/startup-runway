import { useEffect, useMemo, useState } from 'react'
import { formatMoney, formatMonths } from './calc/format'
import { BENCHMARK_DISCLAIMER, benchmarks as buildBenchmarks } from './calc/benchmarks'
import { glossary as buildGlossary } from './copy/glossary'
import { useAppState } from './state/store'
import { PageHeader } from './components/PageHeader'
import { Assumptions } from './components/Assumptions'
import { CompanySection } from './components/CompanySection'
import { HiringSection } from './components/HiringSection'
import { MathContext } from './components/mathContext'
import { Banner, TextButton } from './components/primitives'
import { ResultsRail } from './components/ResultsRail'
import { RoundSection } from './components/RoundSection'
import { ScenarioTable } from './components/ScenarioTable'
import { ScenarioTabs } from './components/ScenarioTabs'
import { ReplacedPlanNotice, SavePlan } from './components/SavePlan'
import { SCENARIO_ORDER } from './calc/defaults'

export function App() {
  const store = useAppState()
  const { results, state, scenario, scenarioRows } = store
  const glossary = useMemo(() => buildGlossary(results), [results])
  const typical = useMemo(() => buildBenchmarks(results), [results])

  const [math, setMath] = useState({ tick: 0, open: false })

  // Keyboard: 1/2/3 pick a scenario, m opens or closes every formula at once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // A bare digit must not swap the plan while the reader is on a button, a switch
      // or a disclosure — only when nothing in particular has focus.
      const el = document.activeElement as HTMLElement | null
      if (el && el !== document.body && el.closest('button, input, textarea, select, [contenteditable]')) {
        return
      }

      if (e.key === 'm') {
        setMath((m) => ({ tick: m.tick + 1, open: !m.open }))
        return
      }
      const index = ['1', '2', '3'].indexOf(e.key)
      if (index >= 0 && SCENARIO_ORDER[index]) store.setActiveScenario(SCENARIO_ORDER[index])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])

  return (
    <MathContext.Provider value={math}>
      <main className="page">
        <PageHeader
          results={results}
          tabs={
            <ScenarioTabs
              rows={scenarioRows}
              activeId={state.activeScenario}
              onSelect={store.setActiveScenario}
              tip={glossary.scenarios}
            />
          }
        />

        <ReplacedPlanNotice store={store} />

        {store.changedElsewhere && (
          <div className="mt-4">
            <Banner tone="warn">
              This plan was changed in another tab. What you see here is the copy this tab loaded —
              reload to pick up the other one, or keep editing and this copy will win.
            </Banner>
          </div>
        )}

        <div className="grid-two mt-2">
          <div>
            <CompanySection store={store} glossary={glossary} typical={typical} />
            <HiringSection store={store} glossary={glossary} typical={typical} />
            <RoundSection store={store} glossary={glossary} typical={typical} />
          </div>

          <div className="rail pt-10">
            <ResultsRail
              results={results}
              glossary={glossary}
              scenarioId={state.activeScenario}
            />
          </div>
        </div>

        <div className="pt-10 mt-2" style={{ borderTop: '1px solid var(--color-hairline)' }}>
          <ScenarioTable
            rows={scenarioRows}
            activeId={state.activeScenario}
            onSelect={store.setActiveScenario}
          />
        </div>

        {/* One polite announcement per plan change, however it was made. */}
        <p className="sr-only" role="status" aria-live="polite">
          {scenario.label} plan: raise {formatMoney(results.capital.plannedRaise)}, runway{' '}
          {formatMonths(results.runway.withRaise)}.
        </p>

        <Assumptions results={results} />

        <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--color-hairline)' }}>
          <div className="t-eyebrow mb-3">Keeping this plan</div>
          <SavePlan store={store} />
        </div>

        <div className="mt-8 flex items-baseline justify-between gap-6">
          <p className="t-small max-w-[62ch]">
            {store.showBenchmarks && <>{BENCHMARK_DISCLAIMER} </>}
            Press <span className="num">1</span>/<span className="num">2</span>/
            <span className="num">3</span> to switch scenarios, <span className="num">m</span> to
            show every formula. Arrow keys step any amount; hold Shift for bigger steps.
          </p>
          <span className="flex items-baseline gap-6">
            <TextButton onClick={() => store.setShowBenchmarks(!store.showBenchmarks)}>
              {store.showBenchmarks ? 'Hide the typical ranges' : 'Show the typical ranges'}
            </TextButton>
            <TextButton
              onClick={() => {
                if (window.confirm('Reset every input back to the starting numbers?')) store.reset()
              }}
            >
              Reset to the starting numbers
            </TextButton>
          </span>
        </div>
      </main>
    </MathContext.Provider>
  )
}
