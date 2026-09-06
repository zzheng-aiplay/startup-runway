import { describe, expect, it } from 'vitest'
import { buildBurnContext } from './burn'
import { computeCapital } from './capital'
import { company, investor, scenario } from './fixtures'

function capital(c = company(), s = scenario()) {
  return computeCapital(buildBurnContext(c, s), c, s)
}

describe('capital required', () => {
  it('Example A: $100k/month for 18 months with no cash needs $1.8M', () => {
    const result = capital()
    expect(result.burnThroughRunway).toBe(1_800_000)
    expect(result.bufferAmount).toBe(0)
    expect(result.recommendedRaise).toBe(1_800_000)
  })

  it('adds the buffer as forward burn beyond the target runway', () => {
    const result = capital(company(), scenario({ bufferMonths: 3 }))
    expect(result.bufferAmount).toBe(300_000)
    expect(result.cashNeeded).toBe(2_100_000)
    expect(result.recommendedRaise).toBe(2_100_000)
  })

  it('nets off cash already in the bank', () => {
    const result = capital(company({ currentCash: 500_000 }), scenario({ bufferMonths: 3 }))
    expect(result.recommendedRaise).toBe(1_600_000)
  })

  it('never recommends a negative raise', () => {
    const result = capital(company({ currentCash: 5_000_000 }))
    expect(result.recommendedRaise).toBe(0)
  })

  it('is the month-by-month sum, not burn × months, once a hire lands mid-plan', () => {
    const s = scenario({
      hires: [{ id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 10 }],
    })
    const result = capital(company(), s)
    // 9 months at 100k + 9 at 110k = 1,890,000. Naive burn × months would say 1,800,000.
    expect(result.burnThroughRunway).toBe(1_890_000)
    expect(result.burnThroughRunway).not.toBe(100_000 * 18)
  })

  it('funds a hire that starts inside the buffer window', () => {
    const withHire = capital(
      company(),
      scenario({
        bufferMonths: 3,
        hires: [{ id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 20 }],
      }),
    )
    // Months 20 and 21 carry the extra 10k each; months 1-18 are untouched.
    expect(withHire.burnThroughRunway).toBe(1_800_000)
    expect(withHire.bufferAmount).toBe(320_000)
  })

  it('follows the recommendation until it is overridden', () => {
    const auto = capital(company(), scenario({ bufferMonths: 3 }))
    expect(auto.isOverridden).toBe(false)
    expect(auto.plannedRaise).toBe(auto.recommendedRaise)

    const manual = capital(company(), scenario({ bufferMonths: 3, plannedRaiseOverride: 1_500_000 }))
    expect(manual.isOverridden).toBe(true)
    expect(manual.plannedRaise).toBe(1_500_000)
    expect(manual.raiseGap).toBe(-600_000)
  })

  it('reconciles the planned raise against the investor checks', () => {
    const s = scenario({
      plannedRaiseOverride: 1_000_000,
      investors: [investor({ id: 'i1' }), investor({ id: 'i2' })],
    })
    const matched = capital(company(), s)
    expect(matched.committedFromInvestors).toBe(1_000_000)
    expect(matched.unallocated).toBe(0)

    const short = capital(
      company(),
      scenario({ plannedRaiseOverride: 1_500_000, investors: [investor()] }),
    )
    expect(short.unallocated).toBe(1_000_000)
  })

  it('treats an override of 0 as a real answer, not as "use the recommendation"', () => {
    const result = capital(company(), scenario({ plannedRaiseOverride: 0 }))
    expect(result.isOverridden).toBe(true)
    expect(result.plannedRaise).toBe(0)
  })
})
