import { formatMoney, formatMonths, formatMonthsShort, formatPct, formatPoints } from '../calc/format'
import type { ModelResults, ScenarioId } from '../calc/types'
import { CapTable } from './CapTable'
import { CashChart } from './CashChart'
import { OwnershipBar } from './OwnershipBar'
import { StatCell, type GlossaryMap } from './primitives'

/**
 * The right-hand rail: the four numbers, then ownership, then the cash picture.
 * Nothing here computes — every value is read off ModelResults so the rail and
 * the inputs can never disagree.
 */
export function ResultsRail({
  results,
  glossary,
  scenarioId,
}: {
  results: ModelResults
  glossary: GlossaryMap
  scenarioId: ScenarioId
}) {
  const { burn, capital, runway, safe, gates } = results
  const target = results.inputs.scenario.targetRunwayMonths
  const buffer = Math.max(0, Math.round(results.inputs.scenario.bufferMonths) || 0)

  return (
    <div>
      {/* Re-keyed on the scenario so the tint flash replays only when the whole
          plan changes, not on every keystroke. */}
      <div className="lattice" key={scenarioId}>
        <StatCell
          label={`Monthly burn · month 1`}
          value={formatMoney(burn.currentMonthlyBurn)}
          sub={
            burn.burnAtEndOfRunway > burn.currentMonthlyBurn
              ? `avg ${formatMoney(burn.averageMonthlyBurn)} over ${target} mo · ${formatMoney(burn.burnAtEndOfRunway)} by month ${target}`
              : `avg ${formatMoney(burn.averageMonthlyBurn)} over ${target} mo · flat the whole way`
          }
          tip={glossary.burnRate}
          flash
        />
        <StatCell
          label="Recommended raise"
          value={formatMoney(capital.recommendedRaise)}
          sub={
            // The headline asks how much to raise, so the number actually planned has
            // to be visible here — this card is the only place above the fold that can
            // carry it now the answer strip is gone.
            capital.isOverridden && Math.abs(capital.raiseGap) > 1
              ? `you plan to raise ${formatMoney(capital.plannedRaise)}`
              : buffer > 0
                ? `${target} mo of burn + a ${buffer} mo buffer`
                : `${target} mo of burn, no buffer`
          }
          tip={glossary.recommendedRaise}
          flash
        />
        <StatCell
          label="Runway"
          value={
            Number.isFinite(runway.withRaise)
              ? formatMonths(runway.withRaise).replace(/ months?$/, '')
              : '—'
          }
          unit={Number.isFinite(runway.withRaise) ? 'mo' : undefined}
          sub={
            runway.hitsTargetRunway
              ? `your ${target} mo target${buffer > 0 ? ` + ${formatMonthsShort(Math.min(buffer, runway.bufferMonthsAchieved))} spare` : ''}`
              : `short of your ${target} mo target`
          }
          subTone={runway.hitsTargetRunway ? 'default' : 'alarm'}
          tip={glossary.runway}
          flash
        />
        <StatCell
          label="Founder dilution"
          value={gates.blockOwnershipComputable ? formatPct(safe.founderDilution, 1) : '—'}
          sub={
            gates.blockOwnershipComputable
              ? `SAFEs ${formatPoints(-safe.dilutionPointsFromSafes)}${
                  safe.dilutionPointsFromPool > 0
                    ? ` · new pool ${formatPoints(-safe.dilutionPointsFromPool)}`
                    : ''
                }`
              : 'waiting on the inputs flagged on the left'
          }
          tip={glossary.dilution}
          flash
        />
      </div>

      <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <div className="text-[13px] leading-[18px] font-semibold text-ink-800">
          Ownership before and after
        </div>
        <div className="mt-3">
          <OwnershipBar results={results} />
        </div>
      </div>

      <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <CapTable results={results} tip={glossary.capTable} />
      </div>

      <CashChart results={results} />
    </div>
  )
}
