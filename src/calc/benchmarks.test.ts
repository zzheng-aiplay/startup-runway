import { describe, expect, it } from 'vitest'
import { benchmarkList, benchmarks, outsideTypical } from './benchmarks'
import { defaultState } from './defaults'
import { company, founder, investor, scenario } from './fixtures'
import { computeModel } from './model'

function typical(c = company(), s = scenario()) {
  return benchmarks(computeModel({ company: c, scenario: s }))
}

const state = defaultState()
const seeded = benchmarks(computeModel({ company: state.company, scenario: state.scenarios.base }))

describe('benchmarks as reference, not rules', () => {
  it('always states the range, whatever the plan says', () => {
    for (const b of benchmarkList(computeModel({ company: company(), scenario: scenario() }))) {
      expect(b.typical.length).toBeGreaterThan(20)
    }
  })

  it('stays quiet on the seeded plan — the defaults are inside the conventions', () => {
    expect(outsideTypical(computeModel({ company: state.company, scenario: state.scenarios.base }))).toBe(0)
    expect(seeded.targetRunway.yours).toBeUndefined()
    expect(seeded.roundDilution.yours).toBeUndefined()
    expect(seeded.founderPay.yours).toBeUndefined()
  })

  it('never blocks anything: a benchmark is a string, and the model is unchanged by it', () => {
    const r = computeModel({ company: state.company, scenario: state.scenarios.base })
    const before = JSON.stringify(r.capital)
    benchmarks(r)
    expect(JSON.stringify(r.capital)).toBe(before)
  })
})

describe('what it notices', () => {
  it('a runway shorter than a seed raise takes to close', () => {
    expect(typical(company(), scenario({ targetRunwayMonths: 9 })).targetRunway.yours).toContain(
      '9 months',
    )
    expect(typical(company(), scenario({ targetRunwayMonths: 18 })).targetRunway.yours).toBeUndefined()
  })

  it('a buffer of nothing, and a buffer of a year', () => {
    expect(typical(company(), scenario({ bufferMonths: 0 })).buffer.yours).toBeDefined()
    expect(typical(company(), scenario({ bufferMonths: 12 })).buffer.yours).toBeDefined()
    expect(typical(company(), scenario({ bufferMonths: 3 })).buffer.yours).toBeUndefined()
  })

  it('founders paying themselves nothing, and founders paying themselves a lot', () => {
    const unpaid = company({ founders: [founder({ annualSalary: 0 })] })
    expect(typical(unpaid).founderPay.yours).toContain('$0')
    const rich = company({ founders: [founder({ annualSalary: 400_000, benefitsRate: 0.25 })] })
    expect(typical(rich).founderPay.yours).toContain('$400,000')
  })

  it('a first hire before anyone knows what to hire for', () => {
    const early = scenario({
      hires: [{ id: 'h', role: 'Engineer', headcount: 1, annualSalary: 150_000, startMonth: 1 }],
    })
    expect(typical(company(), early).firstHire.yours).toContain('month 1')
  })

  it('says something different, and nothing critical, when there are no hires', () => {
    const solo = typical(company(), scenario({ hires: [] })).firstHire
    expect(solo.typical).toContain('founders-only')
    expect(solo.yours).toBeUndefined()
  })

  it('a round that sells too much of the company, and one that sells almost none', () => {
    const heavy = scenario({ investors: [investor({ investment: 2_400_000 })] })
    expect(typical(company(), heavy).roundDilution.yours).toContain('30%')
    const light = scenario({ investors: [investor({ investment: 100_000 })] })
    expect(typical(company(), light).roundDilution.yours).toContain('1.3%')
  })

  it('never judges a cap on its own — only the dilution it produces', () => {
    // A cap is meaningless without the cheque beside it: $1M is cheap for a $25k
    // note and impossible for a $2M one, so the cap line only ever informs.
    for (const c of [1_000_000, 8_000_000, 40_000_000, 90_000_000]) {
      const s = scenario({ investors: [investor({ postMoneyCap: c })] })
      expect(typical(company(), s).cap.yours).toBeUndefined()
    }
    // The same inputs do get judged where it counts.
    const tiny = scenario({ investors: [investor({ postMoneyCap: 1_000_000 })] })
    expect(typical(company(), tiny).roundDilution.yours).toBeDefined()
  })

  it('an option pool well past the usual', () => {
    const big = scenario({ optionPool: { currentPct: 0, newPct: 0.3 } })
    expect(typical(company(), big).optionPool.yours).toContain('30%')
    expect(typical(company(), scenario()).optionPool.yours).toBeUndefined()
  })

  it('a payroll load too small to cover employer payroll taxes', () => {
    expect(typical(company({ payrollLoadRate: 0.02 })).payrollLoad.yours).toContain('2%')
    // 20% is low against the 25 – 35% a US hire really costs, but not absurd, so the
    // range informs without the line pointing at you.
    expect(typical(company({ payrollLoadRate: 0.2 })).payrollLoad.yours).toBeUndefined()
  })

  it('operating costs carrying more of the burn than people', () => {
    const opexHeavy = company({
      founders: [founder({ annualSalary: 0 })],
      expenses: [{ id: 'e', name: 'Cloud', monthlyCost: 40_000 }],
    })
    expect(typical(opexHeavy).operatingCosts.yours).toBeDefined()
  })

  it('says nothing about ownership while the round is impossible', () => {
    const oversold = scenario({ investors: [investor({ investment: 20_000_000 })] })
    expect(typical(company(), oversold).roundDilution.yours).toBeUndefined()
  })
})
