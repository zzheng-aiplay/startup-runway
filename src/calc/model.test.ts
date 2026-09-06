import { describe, expect, it } from 'vitest'
import { defaultState } from './defaults'
import { company, founder, investor, scenario } from './fixtures'
import { computeModel, summarizeScenarios } from './model'

function model(c = company(), s = scenario()) {
  return computeModel({ company: c, scenario: s })
}

describe('the default screen', () => {
  const state = defaultState()
  const base = computeModel({ company: state.company, scenario: state.scenarios.base })

  it('answers the headline question with real numbers', () => {
    expect(base.burn.currentMonthlyBurn).toBe(30_500)
    expect(base.capital.recommendedRaise).toBe(1_046_750)
    expect(base.capital.plannedRaise).toBe(1_050_000)
    expect(base.runway.withRaise).toBeCloseTo(21.053, 3)
    expect(base.runway.hitsTargetRunway).toBe(true)
  })

  it('prices the seeded round the way the seeded cheques say it should', () => {
    // $525,000 twice against an $8M cap.
    expect(base.safe.totalSafeOwnership).toBe(0.13125)
    expect(base.safe.founderRows.map((f) => f.after)).toEqual([0.434375, 0.434375])
    expect(base.safe.founderDilution).toBeCloseTo(0.13125, 12)
  })

  it('has the investor checks adding up to the planned raise', () => {
    expect(base.capital.committedFromInvestors).toBe(1_050_000)
    expect(base.capital.unallocated).toBe(0)
  })

  it('opens with nothing broken — no errors and no warnings, only notes', () => {
    expect(base.gates.ownershipComputable).toBe(true)
    expect(base.warnings.filter((w) => w.severity !== 'info')).toEqual([])
  })

  it('distinguishes month-1 burn from the average and the last month', () => {
    expect(base.burn.averageMonthlyBurn).toBeCloseTo(47_861.11, 2)
    expect(base.burn.burnAtEndOfRunway).toBe(61_750)
    expect(base.burn.currentMonthlyBurn).toBeLessThan(base.burn.averageMonthlyBurn)
  })
})

describe('scenario comparison', () => {
  const rows = summarizeScenarios(defaultState())

  it('produces one comparable row per scenario', () => {
    expect(rows.map((r) => r.id)).toEqual(['lean', 'base', 'aggressive'])
    expect(rows.map((r) => r.plannedRaise)).toEqual([650_000, 1_050_000, 2_240_000])
    expect(rows.map((r) => r.blendedCap)).toEqual([8_000_000, 8_000_000, 12_000_000])
  })

  it('shows more money at the same cap costing more of the company', () => {
    expect(rows[0].totalSafeOwnership).toBeCloseTo(0.08125, 12)
    expect(rows[1].totalSafeOwnership).toBeCloseTo(0.13125, 12)
    expect(rows[2].totalSafeOwnership).toBeCloseTo(0.1866667, 6)
    expect(rows[0].founderBlockAfter).toBeGreaterThan(rows[1].founderBlockAfter)
    expect(rows[1].founderBlockAfter).toBeGreaterThan(rows[2].founderBlockAfter)
  })

  it('reaches every target runway it claims to', () => {
    expect(rows.every((r) => r.hitsTargetRunway)).toBe(true)
    expect(rows.map((r) => r.headcountAtEnd)).toEqual([0, 2, 4])
  })

  it('marks the active scenario', () => {
    expect(rows.filter((r) => r.isActive).map((r) => r.id)).toEqual(['base'])
  })
})

describe('warnings', () => {
  const investors = [investor({ id: 'i1' }), investor({ id: 'i2' })]
  const codes = (m: ReturnType<typeof model>) => m.warnings.map((w) => w.code)

  it('says so when the planned raise misses the target', () => {
    const r = model(company(), scenario({ plannedRaiseOverride: 900_000 }))
    expect(codes(r)).toContain('raise-short')
    expect(r.warnings.find((w) => w.code === 'raise-short')?.message).toContain('9 months')
  })

  it('says so when the investor checks do not add up to the raise', () => {
    const r = model(
      company(),
      scenario({ plannedRaiseOverride: 1_500_000, investors: [investor()] }),
    )
    const warning = r.warnings.find((w) => w.code === 'raise-unallocated')
    expect(warning?.severity).toBe('warn')
    expect(warning?.message).toContain('$1,000,000')
  })

  it('flags different caps in the same round', () => {
    const r = model(
      company(),
      scenario({
        investors: [investor({ id: 'i1' }), investor({ id: 'i2', postMoneyCap: 12_000_000 })],
      }),
    )
    expect(codes(r)).toContain('mixed-caps')
  })

  it('does not nag about caps when only one investor is funded', () => {
    const r = model(
      company(),
      scenario({
        investors: [investor({ id: 'i1' }), investor({ id: 'i2', investment: 0, postMoneyCap: 1 })],
      }),
    )
    expect(codes(r)).not.toContain('mixed-caps')
  })

  it('blocks an impossible round and names the offender', () => {
    const r = model(
      company(),
      scenario({ investors: [investor({ name: 'Big Fund', investment: 9_000_000 })] }),
    )
    const warning = r.warnings.find((w) => w.code === 'safe-oversold')
    expect(warning?.severity).toBe('error')
    expect(warning?.message).toContain('Big Fund')
    expect(r.gates.ownershipComputable).toBe(false)
  })

  it('warns about a heavy but possible round', () => {
    const r = model(
      company(),
      scenario({ investors: [investor({ investment: 3_000_000 })] }),
    )
    expect(codes(r)).toContain('safe-very-high')
    expect(r.gates.ownershipComputable).toBe(true)
  })

  it('explains a founder split that does not total 100%', () => {
    const r = model(
      company({ founders: [founder({ id: 'f1', equityShare: 0.6 }), founder({ id: 'f2', equityShare: 0.6 })] }),
      scenario({ investors }),
    )
    const warning = r.warnings.find((w) => w.code === 'founder-split-sum')
    expect(warning?.severity).toBe('error')
    expect(warning?.message).toContain('120%')
  })

  it('separates hires funded by the buffer from hires nobody is funding', () => {
    const r = model(
      company(),
      scenario({
        targetRunwayMonths: 12,
        bufferMonths: 3,
        hires: [
          { id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 14 },
          { id: 'h2', role: 'Designer', headcount: 1, annualSalary: 120_000, startMonth: 20 },
        ],
      }),
    )
    expect(codes(r)).toContain('hire-after-target')
    expect(codes(r)).toContain('hire-beyond-horizon')
  })

  it('explains what a discount is doing to the math', () => {
    const r = model(company(), scenario({ investors: [investor({ discountRate: 0.2 })] }))
    expect(codes(r)).toContain('discount-modeled')
  })

  it('says when the option-pool target changes nothing', () => {
    const r = model(
      company(),
      scenario({ investors, optionPool: { currentPct: 0.1, newPct: 0.05 } }),
    )
    expect(codes(r)).toContain('pool-no-op')
  })

  it('notices a company that is not spending anything', () => {
    const r = model(
      company({ founders: [founder({ equityShare: 1, annualSalary: 0 })], currentCash: 100_000 }),
      scenario(),
    )
    expect(codes(r)).toContain('zero-burn')
    expect(r.runway.withRaise).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('engine invariants', () => {
  it('never returns NaN, whatever nonsense is entered', () => {
    const r = model(
      company({
        founders: [founder({ equityShare: Number.NaN, annualSalary: Number.NaN })],
        expenses: [{ id: 'e', name: 'x', monthlyCost: Number.NaN }],
        currentCash: Number.NaN,
        payrollLoadRate: Number.NaN,
      }),
      scenario({
        targetRunwayMonths: Number.NaN,
        bufferMonths: Number.NaN,
        plannedRaiseOverride: Number.NaN,
        hires: [{ id: 'h', role: '', headcount: Number.NaN, annualSalary: Number.NaN, startMonth: Number.NaN }],
        investors: [investor({ investment: Number.NaN, postMoneyCap: Number.NaN })],
        optionPool: { currentPct: Number.NaN, newPct: Number.NaN },
      }),
    )
    const numbers = [
      r.burn.currentMonthlyBurn,
      r.burn.averageMonthlyBurn,
      r.capital.recommendedRaise,
      r.capital.plannedRaise,
      r.safe.totalSafeOwnership,
      r.safe.founderBlockAfter,
      r.safe.founderDilution,
      ...r.chart.map((p) => p.cashWithRaise ?? 0),
    ]
    expect(numbers.every((n) => Number.isFinite(n))).toBe(true)
  })

  it('keeps the cap table summing to 100% for every default scenario', () => {
    const state = defaultState()
    for (const id of ['lean', 'base', 'aggressive'] as const) {
      const r = computeModel({ company: state.company, scenario: state.scenarios[id] })
      const total = r.safe.capTable.reduce((acc, row) => acc + row.after, 0)
      expect(total).toBeCloseTo(1, 12)
    }
  })

  it('projects the chart from month 0 with the raise included', () => {
    const r = model(company({ currentCash: 50_000 }), scenario({ plannedRaiseOverride: 1_000_000 }))
    expect(r.chart[0]).toMatchObject({ month: 0, cashWithRaise: 1_050_000, cashNoRaise: 50_000 })
    expect(r.chart.at(-1)?.month).toBe(r.runway.horizon)
  })
})
