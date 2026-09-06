import { describe, expect, it } from 'vitest'
import { buildBurnContext } from './burn'
import { computeCapital } from './capital'
import { company, scenario } from './fixtures'
import {
  buildChart,
  buildHireEvents,
  buildProjection,
  computeRunway,
  computeRunwayMonths,
} from './runway'

describe('runway months', () => {
  const ctx = buildBurnContext(company(), scenario())

  it('counts whole months plus the fraction of the month that breaks the bank', () => {
    expect(computeRunwayMonths(ctx, 300_000).months).toBe(3)
    expect(computeRunwayMonths(ctx, 250_000).months).toBe(2.5)
    expect(computeRunwayMonths(ctx, 1).months).toBeCloseTo(0.00001, 8)
  })

  it('lands on exactly N+B when the raise is exactly the recommendation', () => {
    // The regression that matters: cash hits precisely zero, and a strict `< 0` test
    // there reports an unlimited runway on the app's default screen.
    const s = scenario({ bufferMonths: 3 })
    const c = company()
    const cap = computeCapital(buildBurnContext(c, s), c, s)
    const result = computeRunwayMonths(buildBurnContext(c, s), cap.recommendedRaise)
    expect(cap.recommendedRaise).toBe(2_100_000)
    expect(result.months).toBe(21)
    expect(result.outOfCashMonth).toBe(21)
  })

  it('survives float residue on both sides of zero', () => {
    expect(computeRunwayMonths(ctx, 2_100_000 + 1e-9).months).toBeCloseTo(21, 6)
    expect(computeRunwayMonths(ctx, 2_100_000 - 1e-9).months).toBeCloseTo(21, 6)
  })

  it('is zero when there is no money, not unlimited', () => {
    expect(computeRunwayMonths(ctx, 0).months).toBe(0)
    expect(computeRunwayMonths(ctx, -50_000).months).toBe(0)
    expect(computeRunwayMonths(ctx, 0).outOfCashMonth).toBe(0)
  })

  it('is unlimited only when nothing is being spent', () => {
    const idle = buildBurnContext(
      company({ founders: [], expenses: [] }),
      scenario(),
    )
    expect(computeRunwayMonths(idle, 100_000).months).toBe(Number.POSITIVE_INFINITY)
    expect(computeRunwayMonths(idle, 100_000).outOfCashMonth).toBeNull()
  })

  it('shortens as hires land', () => {
    const withHire = buildBurnContext(
      company(),
      scenario({
        hires: [{ id: 'h1', role: 'Engineer', headcount: 1, annualSalary: 1_200_000, startMonth: 4 }],
      }),
    )
    // 3 months at 100k, then 200k/month: 300k + 2×200k = 700k covers 5 months exactly.
    expect(computeRunwayMonths(withHire, 700_000).months).toBe(5)
    expect(computeRunwayMonths(withHire, 700_000).months).toBeLessThan(
      computeRunwayMonths(buildBurnContext(company(), scenario()), 700_000).months,
    )
  })
})

describe('runway results', () => {
  it('reports the buffer it actually achieved and whether the target is hit', () => {
    const c = company()
    const s = scenario({ bufferMonths: 3 })
    const ctx = buildBurnContext(c, s)

    const exact = computeRunway(ctx, c, s, 2_100_000)
    expect(exact.withRaise).toBe(21)
    expect(exact.cashAtEndOfTargetRunway).toBe(300_000)
    expect(exact.bufferMonthsAchieved).toBe(3)
    expect(exact.hitsTargetRunway).toBe(true)
    expect(exact.targetPlusBuffer).toBe(21)

    const thin = computeRunway(ctx, c, s, 1_000_000)
    expect(thin.withRaise).toBe(10)
    expect(thin.hitsTargetRunway).toBe(false)
    expect(thin.bufferMonthsAchieved).toBe(0)
    expect(thin.cashAtEndOfTargetRunway).toBe(-800_000)
  })

  it('separates runway with and without the raise', () => {
    const c = company({ currentCash: 250_000 })
    const s = scenario()
    const r = computeRunway(buildBurnContext(c, s), c, s, 1_000_000)
    expect(r.withoutRaise).toBe(2.5)
    expect(r.withRaise).toBe(12.5)
  })
})

describe('projection and chart', () => {
  const c = company({ currentCash: 100_000 })
  const s = scenario()
  const ctx = buildBurnContext(c, s)

  it('walks cash down month by month for both series', () => {
    const projection = buildProjection(ctx, c, 500_000, 8)
    expect(projection[0].cashWithRaise).toBe(500_000)
    expect(projection[0].cashWithoutRaise).toBe(0)
    expect(projection[5].cashWithRaise).toBe(0)
    expect(projection.at(-1)?.month).toBe(8)
  })

  it('draws a third line only when the recommendation differs materially', () => {
    const same = buildChart(buildProjection(ctx, c, 500_000, 8), 100_000, 500_000, 500_000)
    expect(same.every((p) => p.cashAtRecommended === null)).toBe(true)

    // Within 2% of the recommendation the two lines would overlap, so no third line.
    const close = buildChart(buildProjection(ctx, c, 500_000, 8), 100_000, 500_000, 495_000)
    expect(close.every((p) => p.cashAtRecommended === null)).toBe(true)

    const differs = buildChart(buildProjection(ctx, c, 500_000, 8), 100_000, 500_000, 300_000)
    expect(differs[0].cashAtRecommended).toBe(400_000)
    expect(differs[4].cashAtRecommended).toBe(0)
    expect(differs[5].cashAtRecommended).toBeNull()
  })

  it('opens the chart at month 0 with the raise as the visible gap', () => {
    const chart = buildChart(buildProjection(ctx, c, 500_000, 8), 100_000, 500_000, 500_000)
    expect(chart[0]).toMatchObject({ month: 0, cashWithRaise: 600_000, cashNoRaise: 100_000 })
  })

  it('clamps each series at zero and stops it at its own wall', () => {
    const chart = buildChart(buildProjection(ctx, c, 500_000, 8), 100_000, 500_000, 500_000)
    // No-raise cash is gone at the end of month 1, so month 2 onward is empty.
    expect(chart[1].cashNoRaise).toBe(0)
    expect(chart[2].cashNoRaise).toBeNull()
    // With the raise it survives to month 6 and never plots a negative balance.
    expect(chart[6].cashWithRaise).toBe(0)
    expect(chart[7].cashWithRaise).toBeNull()
    expect(chart.every((p) => (p.cashWithRaise ?? 0) >= 0)).toBe(true)
  })
})

describe('hire events', () => {
  it('groups hires by start month and labels them', () => {
    const s = scenario({
      targetRunwayMonths: 12,
      bufferMonths: 3,
      hires: [
        { id: 'h1', role: 'Engineer', headcount: 2, annualSalary: 120_000, startMonth: 6 },
        { id: 'h2', role: 'Designer', headcount: 1, annualSalary: 120_000, startMonth: 6 },
        { id: 'h3', role: 'Sales', headcount: 1, annualSalary: 120_000, startMonth: 14 },
      ],
    })
    const events = buildHireEvents(buildBurnContext(company(), s), 24)

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ month: 6, label: '+3 hires', cumulativeHeadcount: 3 })
    expect(events[0].monthlyBurnDelta).toBe(30_000)
    expect(events[1]).toMatchObject({ month: 14, label: '+1 Sales', afterTarget: true })
  })

  it('drops empty hires and anything past the chart horizon', () => {
    const s = scenario({
      hires: [
        { id: 'h1', role: 'Ghost', headcount: 0, annualSalary: 120_000, startMonth: 3 },
        { id: 'h2', role: 'Later', headcount: 1, annualSalary: 120_000, startMonth: 40 },
      ],
    })
    expect(buildHireEvents(buildBurnContext(company(), s), 24)).toHaveLength(0)
  })
})
