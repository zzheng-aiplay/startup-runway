import { describe, expect, it } from 'vitest'
import {
  buildBurnContext,
  burnAtMonth,
  burnBetween,
  headcountAtMonth,
  summarizeBurn,
} from './burn'
import { company, scenario } from './fixtures'

describe('monthly burn', () => {
  it('adds founder comp, benefits load, and operating expenses', () => {
    const c = company({
      founders: [
        {
          id: 'f1',
          name: 'A',
          equityShare: 0.5,
          annualSalary: 120_000,
          benefitsRate: 0.15,
        },
        {
          id: 'f2',
          name: 'B',
          equityShare: 0.5,
          annualSalary: 120_000,
          benefitsRate: 0.15,
        },
      ],
      expenses: [
        { id: 'e1', name: 'Cloud', monthlyCost: 1_200 },
        { id: 'e2', name: 'AI', monthlyCost: 1_500 },
      ],
    })
    const ctx = buildBurnContext(c, scenario())

    // 2 × (120k/12) × 1.15 = 23,000 of payroll, plus 2,700 of expenses.
    expect(ctx.founderMonthlyComp).toBe(23_000)
    expect(ctx.operatingMonthly).toBe(2_700)
    expect(burnAtMonth(ctx, 1)).toBe(25_700)
  })

  it('is exactly $100k/month for the base fixture', () => {
    const ctx = buildBurnContext(company(), scenario())
    expect(burnAtMonth(ctx, 1)).toBe(100_000)
    expect(burnAtMonth(ctx, 18)).toBe(100_000)
    expect(burnBetween(ctx, 1, 18)).toBe(1_800_000)
  })

  it('treats a negative or missing salary as zero rather than a credit', () => {
    const ctx = buildBurnContext(
      company({
        founders: [{ id: 'f1', name: 'A', equityShare: 1, annualSalary: -600_000, benefitsRate: 0 }],
        expenses: [{ id: 'e1', name: 'Odd', monthlyCost: -5_000 }],
      }),
      scenario(),
    )
    expect(burnAtMonth(ctx, 1)).toBe(0)
  })
})

describe('hiring impact', () => {
  const c = company()
  const s = scenario({
    hires: [
      { id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 6 },
      { id: 'h2', role: 'Designer', headcount: 2, annualSalary: 120_000, startMonth: 12 },
    ],
  })
  const withLoad = company({ payrollLoadRate: 0.2 })

  it('steps burn up only from the start month', () => {
    const ctx = buildBurnContext(c, s)
    expect(burnAtMonth(ctx, 5)).toBe(100_000)
    expect(burnAtMonth(ctx, 6)).toBe(110_000)
    expect(burnAtMonth(ctx, 11)).toBe(110_000)
    expect(burnAtMonth(ctx, 12)).toBe(130_000)
  })

  it('applies the payroll load to hires', () => {
    const ctx = buildBurnContext(withLoad, s)
    // 120k/12 = 10,000 × 1.2 = 12,000 for one head.
    expect(burnAtMonth(ctx, 6)).toBe(112_000)
    expect(burnAtMonth(ctx, 12)).toBe(136_000)
  })

  it('counts headcount by month, excluding founders', () => {
    const ctx = buildBurnContext(c, s)
    expect(headcountAtMonth(ctx, 5)).toBe(0)
    expect(headcountAtMonth(ctx, 6)).toBe(1)
    expect(headcountAtMonth(ctx, 12)).toBe(3)
  })

  it('rounds a fractional start month and floors it at month 1', () => {
    const ctx = buildBurnContext(
      c,
      scenario({
        hires: [
          { id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 0 },
          { id: 'h2', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 4.6 },
        ],
      }),
    )
    expect(burnAtMonth(ctx, 1)).toBe(110_000)
    expect(burnAtMonth(ctx, 4)).toBe(110_000)
    expect(burnAtMonth(ctx, 5)).toBe(120_000)
  })

  it('flags hires that land after the target and after the funded horizon', () => {
    const s2 = scenario({
      targetRunwayMonths: 12,
      bufferMonths: 3,
      hires: [
        { id: 'h1', role: 'In plan', headcount: 1, annualSalary: 120_000, startMonth: 12 },
        { id: 'h2', role: 'In buffer', headcount: 1, annualSalary: 120_000, startMonth: 14 },
        { id: 'h3', role: 'Off plan', headcount: 1, annualSalary: 120_000, startMonth: 20 },
      ],
    })
    const ctx = buildBurnContext(c, s2)
    expect(ctx.hireCosts.map((h) => [h.afterTarget, h.beyondHorizon])).toEqual([
      [false, false],
      [true, false],
      [true, true],
    ])
  })
})

describe('burn summary', () => {
  it('separates month-1 burn from the average and the final month', () => {
    const s = scenario({
      targetRunwayMonths: 12,
      hires: [{ id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 7 }],
    })
    const ctx = buildBurnContext(company(), s)
    const burn = summarizeBurn(ctx, s, 24)

    expect(burn.currentMonthlyBurn).toBe(100_000)
    expect(burn.burnAtEndOfRunway).toBe(110_000)
    // Six months at 100k, six at 110k.
    expect(burn.averageMonthlyBurn).toBe(105_000)
    expect(burn.burnGrowthOverRunway).toBeCloseTo(0.1, 10)
    expect(burn.burnByMonth).toHaveLength(24)
    expect(burn.hiresInMonthOne).toBe(false)
  })

  it('reports hires that start in month 1 so the card can say so', () => {
    const s = scenario({
      hires: [{ id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 120_000, startMonth: 1 }],
    })
    const ctx = buildBurnContext(company(), s)
    expect(summarizeBurn(ctx, s, 12).hiresInMonthOne).toBe(true)
  })
})
