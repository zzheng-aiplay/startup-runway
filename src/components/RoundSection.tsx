import { MINUS, formatMoney, formatPct, formatPoints } from '../calc/format'
import type { Benchmark, BenchmarkCode } from '../calc/benchmarks'
import { RaiseMath, RunwayMath, SafeMath } from '../copy/math'
import type { Store } from '../state/store'
import {
  AddRow,
  Field,
  GroupLabel,
  InfoTip,
  ListBlock,
  ListFooter,
  ListHeader,
  ListRow,
  MoneyInput,
  Num,
  PercentInput,
  RemoveRow,
  Section,
  TextButton,
  TextField,
  Toggle,
  Typical,
  Warnings,
  type GlossaryMap,
} from './primitives'

const INVESTOR_GRID = 'minmax(0,1fr) 176px 176px 20px'

export function RoundSection({
  store,
  glossary,
  typical,
}: {
  store: Store
  glossary: GlossaryMap
  typical: Record<BenchmarkCode, Benchmark>
}) {
  const { scenario, results, showBenchmarks } = store
  const { capital, safe } = results
  const target = scenario.targetRunwayMonths
  const buffer = Math.max(0, Math.round(scenario.bufferMonths) || 0)
  const cash = Math.max(0, store.state.company.currentCash)
  const discounted = safe.investors.find((i) => i.discountRate > 0 && i.effectiveCap > 0)
  const discountedCap = discounted ? discounted.effectiveCap : null

  return (
    <Section
      eyebrow="Step 3"
      title="The round"
      deck="What you plan to raise, on what terms, and from whom. The dilution below always describes the cheques on this list."
    >
      <GroupLabel>The raise</GroupLabel>

      <Field
        label="Recommended raise"
        tip={glossary.recommendedRaise}
        below={
          <p className="t-caption num mt-0.5 mb-2">
            {formatMoney(capital.recommendedRaise)} = {formatMoney(capital.burnThroughRunway)} for{' '}
            {target} months
            {buffer > 0 ? ` + ${formatMoney(capital.bufferAmount)} for a ${buffer}-month buffer` : ''}
            {cash > 0 ? ` ${MINUS} ${formatMoney(cash)} already in the bank` : ''}
          </p>
        }
      >
        <span className="t-value num pr-0.5">{formatMoney(capital.recommendedRaise)}</span>
      </Field>

      <Field
        label="What we plan to raise"
        tip={glossary.plannedRaise}
        echo={
          capital.isOverridden && Math.abs(capital.raiseGap) > 1 ? (
            <Num>
              {capital.raiseGap > 0 ? '+' : MINUS}
              {formatMoney(Math.abs(capital.raiseGap)).replace('$', '$')} vs recommended
            </Num>
          ) : undefined
        }
        below={
          <div className="flex justify-end gap-4 mt-1">
            {capital.isOverridden && (
              <TextButton onClick={() => store.patchScenario({ plannedRaiseOverride: null })}>
                Follow the recommendation
              </TextButton>
            )}
            {!capital.isOverridden && (
              <span className="t-echo">following the recommendation</span>
            )}
          </div>
        }
      >
        <MoneyInput
          value={capital.plannedRaise}
          onChange={(plannedRaiseOverride) => store.patchScenario({ plannedRaiseOverride })}
          ariaLabel="Planned raise"
        />
      </Field>
      <Warnings warnings={results.warnings} field="raise" />
      <Typical benchmark={typical.raiseSize} show={showBenchmarks} />
      <RaiseMath results={results} />
      <RunwayMath results={results} />

      <div className="mt-7">
        <GroupLabel tip={glossary.safe}>SAFE terms</GroupLabel>
        <Field label="Post-money valuation cap" tip={glossary.postMoneyCap}>
          <MoneyInput
            value={scenario.safe.postMoneyCap}
            onChange={(postMoneyCap) => store.setSafeTerms({ postMoneyCap })}
            ariaLabel="Post-money valuation cap"
          />
        </Field>
        <Field
          label="Discount (optional)"
          tip={scenario.safe.discountRate > 0 ? glossary.effectiveCap : glossary.discount}
          echo={
            // Read off the investors, not off the terms: an echo derived from the
            // input can claim a discount is priced in when no cheque carries it.
            discountedCap !== null ? (
              <Num>modelled at a {formatMoney(discountedCap)} effective cap</Num>
            ) : undefined
          }
        >
          <PercentInput
            value={scenario.safe.discountRate}
            onChange={(discountRate) => store.setSafeTerms({ discountRate })}
            digits={0}
            max={50}
            ariaLabel="SAFE discount"
          />
        </Field>
        <Typical benchmark={typical.cap} show={showBenchmarks} />
        <Toggle
          label="MFN clause"
          tip={glossary.mfn}
          sub="Noted, not modelled — an MFN lets this investor take the best terms you later give anyone else, which can only increase their share."
          checked={scenario.safe.mfn}
          onChange={(mfn) => store.setSafeTerms({ mfn })}
        />
      </div>

      <div className="mt-7">
        <GroupLabel>Investors</GroupLabel>
        <Toggle
          label="Same terms for all investors"
          sub={
            scenario.safe.sameTermsForAll
              ? 'Keeps every investor on the cap and discount above.'
              : 'Caps are per investor below. Typing in the cap or discount above still applies it to everyone.'
          }
          checked={scenario.safe.sameTermsForAll}
          onChange={(sameTermsForAll) => store.setSafeTerms({ sameTermsForAll })}
        />

        <div className="mt-3">
          <ListBlock minWidth={610}>
            <ListHeader
            template={INVESTOR_GRID}
            columns={['Investor', { label: 'Investment' }, { label: 'Post-money cap' }, { label: '' }]}
          />
          {scenario.investors.map((investor, index) => {
            const computed = safe.investors[index]
            return (
              <ListRow key={investor.id} template={INVESTOR_GRID}>
                <div className="min-w-0">
                  <TextField
                    value={investor.name}
                    onChange={(name) => store.updateInvestor(investor.id, { name })}
                    placeholder={`Investor ${index + 1}`}
                    ariaLabel={`Investor ${index + 1} name`}
                  />
                  <div className="t-echo num truncate">
                    {computed && computed.investment > 0
                      ? computed.capInvalid
                        ? 'needs a valuation cap'
                        : `${formatPct(computed.ownership)} at conversion`
                      : 'no cheque yet'}
                  </div>
                </div>
                <MoneyInput
                  value={investor.investment}
                  onChange={(investment) => store.updateInvestor(investor.id, { investment })}
                  ariaLabel={`${investor.name || `Investor ${index + 1}`} investment`}
                />
                <MoneyInput
                  value={investor.postMoneyCap}
                  onChange={(postMoneyCap) => store.updateInvestor(investor.id, { postMoneyCap })}
                  derived={scenario.safe.sameTermsForAll}
                  invalid={computed?.capInvalid}
                  ariaLabel={`${investor.name || `Investor ${index + 1}`} post-money cap`}
                />
                {scenario.investors.length > 1 ? (
                  <RemoveRow
                    label={investor.name || `Investor ${index + 1}`}
                    onClick={() => store.removeInvestor(investor.id)}
                  />
                ) : (
                  <span />
                )}
              </ListRow>
            )
          })}
            {scenario.investors.length < 8 && (
              <AddRow label="Add investor" onClick={store.addInvestor} />
            )}
          </ListBlock>

          <ListFooter>
            <span className="t-total num">
              Total {formatMoney(capital.committedFromInvestors)}
            </span>
            {safe.impliedPostMoneyValuation > 0 && (
              <span className="t-echo num ml-3">
                implies a {formatMoney(safe.impliedPostMoneyValuation)} post-money
                {glossary.impliedValuation && <InfoTip {...glossary.impliedValuation} />}
              </span>
            )}
          </ListFooter>

          {Math.abs(capital.unallocated) > 1 && (
            <div className="flex justify-end gap-4 mt-1">
              <TextButton onClick={() => store.matchInvestorsToRaise(capital.plannedRaise)}>
                Match cheques to the {formatMoney(capital.plannedRaise)} raise
              </TextButton>
              <TextButton
                onClick={() =>
                  store.patchScenario({ plannedRaiseOverride: capital.committedFromInvestors })
                }
              >
                Plan to raise {formatMoney(capital.committedFromInvestors)} instead
              </TextButton>
            </div>
          )}
          {!scenario.safe.sameTermsForAll &&
            results.warnings.some((w) => w.code === 'mixed-caps') && (
              <div className="flex justify-end mt-1">
                <TextButton onClick={store.applySharedCap}>
                  Put everyone on the {formatMoney(scenario.investors[0]?.postMoneyCap ?? 0)} cap
                </TextButton>
              </div>
            )}
          <Warnings warnings={results.warnings} field="investors" max={3} />
          <Typical benchmark={typical.roundDilution} show={showBenchmarks} />
          <SafeMath results={results} />
        </div>
      </div>

      <div className="mt-7">
        <GroupLabel>Employee option pool</GroupLabel>
        <Field label="Pool already reserved today" tip={glossary.optionPoolCurrent}>
          <PercentInput
            value={scenario.optionPool.currentPct}
            onChange={(currentPct) =>
              store.patchScenario({ optionPool: { ...scenario.optionPool, currentPct } })
            }
            digits={1}
            max={95}
            ariaLabel="Option pool reserved today"
          />
        </Field>
        <Field
          label="Total pool we want after the round"
          tip={glossary.optionPoolNew}
          below={
            <p className="t-caption num mt-0.5">
              {safe.poolPreSafePct === 0
                ? 'No pool modelled. Founders hold everything that is not sold to investors.'
                : safe.poolIsNoOp
                  ? `No new pool created — the ${formatPct(scenario.optionPool.currentPct, 1)} you already have is at or above this target.`
                  : `To leave ${formatPct(safe.poolPostRoundPct, 1)} in the pool after the round, ${formatPct(safe.poolPreSafePct, 1)} is set aside before the SAFEs convert — so they dilute the pool back down to what you asked for, and the ${formatPoints(-safe.dilutionPointsFromPool)} of gross-up comes off you rather than off the investors.`}
            </p>
          }
        >
          <PercentInput
            value={scenario.optionPool.newPct}
            onChange={(newPct) =>
              store.patchScenario({ optionPool: { ...scenario.optionPool, newPct } })
            }
            digits={1}
            max={95}
            ariaLabel="Total option pool after the round"
          />
        </Field>
        <Warnings warnings={results.warnings} field="pool" />
        <Typical benchmark={typical.optionPool} show={showBenchmarks} />
      </div>
    </Section>
  )
}
