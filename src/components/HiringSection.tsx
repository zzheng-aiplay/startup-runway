import { formatMoney } from '../calc/format'
import type { Benchmark, BenchmarkCode } from '../calc/benchmarks'
import type { Store } from '../state/store'
import {
  AddRow,
  Field,
  IntInput,
  ListBlock,
  ListFooter,
  ListHeader,
  ListRow,
  MoneyInput,
  PercentInput,
  RemoveRow,
  Section,
  TextField,
  Typical,
  Warnings,
  type GlossaryMap,
} from './primitives'

const HIRE_GRID = 'minmax(0,1fr) 64px 176px 88px 20px'

export function HiringSection({
  store,
  glossary,
  typical,
}: {
  store: Store
  glossary: GlossaryMap
  typical: Record<BenchmarkCode, Benchmark>
}) {
  const { state, scenario, results, showBenchmarks } = store
  const hires = results.burn.hireCosts
  const totalHireCost = hires.reduce((acc, h) => acc + h.monthlyCost, 0)
  const heads = hires.reduce((acc, h) => acc + h.headcount, 0)

  return (
    <Section
      eyebrow="Step 2"
      title="Who you plan to hire"
      deck="Every hire raises burn from their start month onward. This is why the raise is a month-by-month sum rather than today's burn multiplied out."
    >
      <Field
        label="Payroll load on new hires"
        tip={glossary.payrollLoad}
        echo={<span className="t-echo">taxes, benefits, tooling</span>}
      >
        <PercentInput
          value={state.company.payrollLoadRate}
          onChange={(payrollLoadRate) => store.patchCompany({ payrollLoadRate })}
          digits={0}
          ariaLabel="Payroll load on new hires"
        />
      </Field>
      <Typical benchmark={typical.payrollLoad} show={showBenchmarks} />

      <div className="mt-4">
        <ListBlock minWidth={600}>
          <ListHeader
          template={HIRE_GRID}
          columns={[
            'Role',
            'People',
            { label: 'Salary / yr' },
            { label: 'Starts', tip: glossary.hireStartMonth },
            { label: '' },
          ]}
        />
        {scenario.hires.map((hire, index) => {
          const cost = hires[index]
          return (
            <ListRow key={hire.id} template={HIRE_GRID}>
              <div className="min-w-0">
                <TextField
                  value={hire.role}
                  onChange={(role) => store.updateHire(hire.id, { role })}
                  placeholder="Founding Engineer"
                  ariaLabel={`Hire ${index + 1} role`}
                />
                <div className="t-echo num truncate">
                  {cost && cost.monthlyCost > 0
                    ? `${formatMoney(cost.monthlyCost)}/mo loaded from M${cost.startMonth}`
                    : 'no cost yet'}
                  {cost?.beyondHorizon
                    ? ' · past this plan'
                    : cost?.afterTarget
                      ? ' · buffer only'
                      : ''}
                </div>
              </div>
              <IntInput
                value={hire.headcount}
                onChange={(headcount) => store.updateHire(hire.id, { headcount })}
                min={1}
                max={99}
                prefix="×"
                width={64}
                ariaLabel={`${hire.role || `Hire ${index + 1}`} headcount`}
              />
              <MoneyInput
                value={hire.annualSalary}
                onChange={(annualSalary) => store.updateHire(hire.id, { annualSalary })}
                ariaLabel={`${hire.role || `Hire ${index + 1}`} annual salary`}
              />
              <IntInput
                value={hire.startMonth}
                onChange={(startMonth) => store.updateHire(hire.id, { startMonth })}
                min={1}
                max={60}
                prefix="M"
                width={88}
                ariaLabel={`${hire.role || `Hire ${index + 1}`} start month`}
              />
              <RemoveRow
                label={hire.role || `hire ${index + 1}`}
                onClick={() => store.removeHire(hire.id)}
              />
            </ListRow>
          )
        })}
          <AddRow label="Add hire" onClick={store.addHire} />
        </ListBlock>

        <ListFooter>
          {scenario.hires.length === 0 ? (
            <span className="num">
              No hires in this scenario — burn stays flat at{' '}
              {formatMoney(results.burn.currentMonthlyBurn)} / mo
            </span>
          ) : (
            <span className="num">
              {heads} {heads === 1 ? 'person' : 'people'} · {formatMoney(totalHireCost)} / mo once
              everyone has started
            </span>
          )}
        </ListFooter>
        <Warnings warnings={results.warnings} field="hires" />
        <Typical benchmark={typical.firstHire} show={showBenchmarks} />
      </div>
    </Section>
  )
}
