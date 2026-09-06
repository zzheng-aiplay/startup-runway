import { formatMoney, formatPct } from '../calc/format'
import { sum } from '../calc/numbers'
import { COST_RANGES, COST_RANGE_CAVEAT, costRangeTotal } from '../calc/benchmarks'
import type { Benchmark, BenchmarkCode } from '../calc/benchmarks'
import { BurnMath } from '../copy/math'
import { founderPhrase } from '../copy/people'
import type { Store } from '../state/store'
import {
  AddRow,
  Field,
  GroupLabel,
  IntInput,
  ListBlock,
  ListFooter,
  ListHeader,
  InfoTip,
  ListRow,
  MoneyInput,
  Typical,
  PercentInput,
  RemoveRow,
  Disclosure,
  Section,
  Slider,
  TextButton,
  TextField,
  Warnings,
  type GlossaryMap,
} from './primitives'

const FOUNDER_GRID = 'minmax(0,1fr) 92px 176px 92px 20px'
const EXPENSE_GRID = 'minmax(0,1fr) 176px 20px'

export function CompanySection({
  store,
  glossary,
  typical,
}: {
  store: Store
  glossary: GlossaryMap
  typical: Record<BenchmarkCode, Benchmark>
}) {
  const { state, scenario, results, showBenchmarks } = store
  const { company } = state
  const splitTotal = sum(company.founders.map((f) => f.equityShare))
  const splitOk = results.gates.founderSplitValid

  return (
    <Section
      eyebrow="Step 1"
      title="The company"
      deck={`What ${founderPhrase(company.founders.length)} cost to run each month, and what is in the bank today.`}
    >
      <GroupLabel tip={glossary.founderSplit}>Founders</GroupLabel>
      <ListBlock minWidth={630}>
        <ListHeader
          template={FOUNDER_GRID}
        columns={[
          'Founder',
          { label: 'Split', tip: glossary.founderSplit },
          { label: 'Salary / yr' },
          { label: 'Load', tip: glossary.benefitsLoad },
          { label: '', align: 'right' },
        ]}
      />
      {company.founders.map((founder, index) => {
        const cost = results.burn.founderCosts[index]
        const ownedToday = results.safe.founderRows[index]?.before ?? 0
        return (
          <ListRow key={founder.id} template={FOUNDER_GRID}>
            <div className="min-w-0">
              <TextField
                value={founder.name}
                onChange={(name) => store.updateFounder(founder.id, { name })}
                placeholder={`Founder ${index + 1}`}
                ariaLabel={`Founder ${index + 1} name`}
              />
              <div className="t-echo num truncate">
                {formatPct(ownedToday, 1)} today
                {cost && cost.monthlyCost > 0 ? ` · ${formatMoney(cost.monthlyCost)}/mo` : ''}
              </div>
            </div>
            <PercentInput
              value={founder.equityShare}
              onChange={(equityShare) => store.updateFounder(founder.id, { equityShare })}
              invalid={!splitOk}
              digits={1}
              ariaLabel={`${founder.name || `Founder ${index + 1}`} share of founder equity`}
            />
            <MoneyInput
              value={founder.annualSalary}
              onChange={(annualSalary) => store.updateFounder(founder.id, { annualSalary })}
              ariaLabel={`${founder.name || `Founder ${index + 1}`} annual salary`}
            />
            <PercentInput
              value={founder.benefitsRate}
              onChange={(benefitsRate) => store.updateFounder(founder.id, { benefitsRate })}
              digits={0}
              ariaLabel={`${founder.name || `Founder ${index + 1}`} benefits load`}
            />
            {company.founders.length > 1 ? (
              <RemoveRow
                label={founder.name || `Founder ${index + 1}`}
                onClick={() => store.removeFounder(founder.id)}
              />
            ) : (
              <span />
            )}
          </ListRow>
        )
      })}
        {company.founders.length < 4 && <AddRow label="Add founder" onClick={store.addFounder} />}
      </ListBlock>

      <div className="flex items-baseline justify-end gap-3 mt-2" role="status" aria-live="polite">
        {!splitOk && <TextButton onClick={store.splitEvenly}>Split evenly</TextButton>}
        <span
          className="t-echo num"
          style={splitOk ? undefined : { color: 'var(--color-danger-ink)' }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
            style={{
              background: splitOk ? 'var(--color-cash-in)' : 'var(--color-danger)',
            }}
          />
          {splitOk
            ? `splits to ${formatPct(splitTotal, 1)} of the founders' equity`
            : `splits to ${formatPct(splitTotal, 1)} — it has to total 100%`}
        </span>
      </div>

      <p className="t-note mt-3 pl-3" style={{ borderLeft: '2px solid var(--color-rule)' }}>
        Salary affects burn rate. Equity determines ownership.
        {glossary.equityVsSalary && <InfoTip {...glossary.equityVsSalary} />}
      </p>
      <p className="t-caption mt-2 max-w-[62ch]">
        The split above divides the founders&rsquo; own stake, and each line shows what that is as a
        share of the whole company. This model assumes the founders plus the option pool own
        everything today; advisor or angel shares from before this round are not modelled.
      </p>
      <Warnings warnings={results.warnings} field="founders" />
      <Typical benchmark={typical.founderPay} show={showBenchmarks} />
      <ListFooter>
        <span className="num">
          {company.founders.length} founder{company.founders.length === 1 ? '' : 's'} ·{' '}
          {formatMoney(results.burn.founderMonthlyComp)} / mo
        </span>
      </ListFooter>

      <div className="mt-7">
        <GroupLabel>Monthly costs</GroupLabel>
        <ListBlock minWidth={420}>
          <ListHeader template={EXPENSE_GRID} columns={['Cost', '$ / month', { label: '' }]} />
        {company.expenses.map((expense, index) => (
          <ListRow key={expense.id} template={EXPENSE_GRID}>
            <TextField
              value={expense.name}
              onChange={(name) => store.updateExpense(expense.id, { name })}
              placeholder="What is it for?"
              ariaLabel={`Cost ${index + 1} name`}
            />
            <MoneyInput
              value={expense.monthlyCost}
              onChange={(monthlyCost) => store.updateExpense(expense.id, { monthlyCost })}
              ariaLabel={`${expense.name || `Cost ${index + 1}`} monthly amount`}
            />
            <RemoveRow
              label={expense.name || `cost ${index + 1}`}
              onClick={() => store.removeExpense(expense.id)}
            />
          </ListRow>
        ))}
          <AddRow label="Add cost" onClick={store.addExpense} />
        </ListBlock>
        <ListFooter>
          <span className="num">
            {company.expenses.length} line{company.expenses.length === 1 ? '' : 's'} ·{' '}
            {formatMoney(results.burn.operatingMonthly)} / mo
          </span>
        </ListFooter>
        <Warnings warnings={results.warnings} field="expenses" />
        <Typical benchmark={typical.operatingCosts} show={showBenchmarks} />
        {showBenchmarks && (
          <Disclosure label="What do these usually cost?" openLabel="Hide the usual costs">
            <ul className="m-0 p-0 list-none">
              {COST_RANGES.map((line) => (
                <li key={line.name} className="mb-2 last:mb-0">
                  <span className="t-td">{line.name}</span>
                  <span className="t-td num text-ink-900"> — {line.range}</span>
                  {line.note && <span className="t-caption block">{line.note}</span>}
                </li>
              ))}
            </ul>
            <p className="t-caption mt-3">All in, that is {costRangeTotal()} for a small team.</p>
            <p className="t-small mt-2 max-w-[62ch]">{COST_RANGE_CAVEAT}</p>
          </Disclosure>
        )}
      </div>

      <div className="mt-7">
        <GroupLabel>Cash and runway</GroupLabel>
        <Field
          label="Cash in the bank today"
          tip={glossary.currentCash}
          echo={
            company.currentCash > 0 ? (
              <span className="num">
                {formatPct(
                  results.capital.cashNeeded > 0
                    ? company.currentCash / results.capital.cashNeeded
                    : 0,
                  0,
                )}{' '}
                of the plan
              </span>
            ) : undefined
          }
        >
          <MoneyInput
            value={company.currentCash}
            onChange={(currentCash) => store.patchCompany({ currentCash })}
            ariaLabel="Cash in the bank today"
          />
        </Field>

        <Field
          label="How long we want the money to last"
          tip={glossary.targetRunway}
          below={
            <div className="pb-2">
              <Slider
                value={scenario.targetRunwayMonths}
                onChange={(targetRunwayMonths) => store.patchScenario({ targetRunwayMonths })}
                min={3}
                max={36}
                ariaLabel="Target runway in months"
                ticks={[6, 12, 18, 24, 30]}
                endLabels={['3 mo', '36 mo']}
              />
            </div>
          }
        >
          <IntInput
            value={scenario.targetRunwayMonths}
            onChange={(targetRunwayMonths) => store.patchScenario({ targetRunwayMonths })}
            min={3}
            max={36}
            prefix="M"
            ariaLabel="Target runway in months"
          />
        </Field>
        <Typical benchmark={typical.targetRunway} show={showBenchmarks} />

        <Field
          label="Extra months to keep in the bank"
          tip={glossary.cashBuffer}
          echo={
            <span className="num">{formatMoney(results.capital.bufferAmount)} of the raise</span>
          }
          below={
            <div className="pb-2">
              <Slider
                value={scenario.bufferMonths}
                onChange={(bufferMonths) => store.patchScenario({ bufferMonths })}
                min={0}
                max={12}
                ariaLabel="Buffer months beyond the target runway"
                ticks={[3, 6, 9]}
                endLabels={['0 mo', '12 mo']}
              />
            </div>
          }
        >
          <IntInput
            value={scenario.bufferMonths}
            onChange={(bufferMonths) => store.patchScenario({ bufferMonths })}
            min={0}
            max={12}
            prefix="M"
            ariaLabel="Buffer months beyond the target runway"
          />
        </Field>
        <Typical benchmark={typical.buffer} show={showBenchmarks} />
        <Warnings warnings={results.warnings} field="cash" />
      </div>

      <BurnMath results={results} />
    </Section>
  )
}
