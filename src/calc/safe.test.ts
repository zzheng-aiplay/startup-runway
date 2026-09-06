import { describe, expect, it } from 'vitest'
import { company, founder, investor, scenario } from './fixtures'
import { sum } from './numbers'
import { computeSafe } from './safe'

const twoFounders = company()

describe('SAFE dilution', () => {
  it('Example B: $500K + $500K at an $8M post-money cap is 12.5%, founders keep 87.5%', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors: [investor({ id: 'i1' }), investor({ id: 'i2' })] }),
    )

    expect(safe.investors.map((i) => i.ownership)).toEqual([0.0625, 0.0625])
    expect(safe.totalSafeOwnership).toBe(0.125)
    expect(safe.founderBlockAfter).toBe(0.875)
    expect(safe.founderRows.map((f) => f.after)).toEqual([0.4375, 0.4375])
    expect(safe.founderDilution).toBe(0.125)
  })

  it('Example C: $1M + $500K at a $10M cap is 15%, founders keep 85%', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({
        investors: [
          investor({ id: 'i1', investment: 1_000_000, postMoneyCap: 10_000_000 }),
          investor({ id: 'i2', investment: 500_000, postMoneyCap: 10_000_000 }),
        ],
      }),
    )

    expect(safe.investors.map((i) => i.ownership)).toEqual([0.1, 0.05])
    expect(safe.totalSafeOwnership).toBeCloseTo(0.15, 12)
    expect(safe.founderBlockAfter).toBeCloseTo(0.85, 12)
    expect(safe.founderRows[0].after).toBeCloseTo(0.425, 12)
  })

  it('scales with any number of investors', () => {
    const investors = [1, 2, 3, 4, 5].map((n) =>
      investor({ id: `i${n}`, name: `Investor ${n}`, investment: 200_000 }),
    )
    const { safe } = computeSafe(twoFounders, scenario({ investors }))
    expect(safe.totalSafeOwnership).toBeCloseTo(0.125, 12)
    expect(safe.investors).toHaveLength(5)
  })

  it('splits dilution by each founder’s share, not evenly', () => {
    const uneven = company({
      founders: [
        founder({ id: 'f1', equityShare: 0.7 }),
        founder({ id: 'f2', equityShare: 0.3 }),
      ],
    })
    const { safe } = computeSafe(uneven, scenario({ investors: [investor()] }))
    expect(safe.founderRows.map((f) => f.after)).toEqual([0.65625, 0.28125])
    // Relative dilution is identical for both, only the absolute points differ.
    expect(safe.founderDilution).toBe(0.0625)
  })

  it('models a discount as an equivalent lower cap', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors: [investor({ discountRate: 0.2 })] }),
    )
    expect(safe.investors[0].effectiveCap).toBe(6_400_000)
    expect(safe.investors[0].ownership).toBeCloseTo(0.078125, 12)
  })

  it('clamps an absurd discount instead of producing a negative cap', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors: [investor({ discountRate: 20 })] }),
    )
    expect(safe.investors[0].effectiveCap).toBe(4_000_000)
    expect(safe.investors[0].ownership).toBeGreaterThan(0)
  })

  it('reports a blended cap and implied post-money valuation across mixed terms', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({
        investors: [
          investor({ id: 'i1', investment: 500_000, postMoneyCap: 8_000_000 }),
          investor({ id: 'i2', investment: 500_000, postMoneyCap: 12_000_000 }),
        ],
      }),
    )
    // 6.25% + 4.1667% = 10.4167% for $1M -> a $9.6M implied post-money.
    expect(safe.totalSafeOwnership).toBeCloseTo(0.1041667, 6)
    expect(safe.blendedCap).toBeCloseTo(9_600_000, 4)
    expect(safe.impliedPostMoneyValuation).toBeCloseTo(9_600_000, 4)
  })
})

describe('option pool', () => {
  const investors = [investor({ id: 'i1' }), investor({ id: 'i2' })]

  it('creates the pool before the SAFEs, so the pool is diluted too', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0, newPct: 0.1 } }),
    )
    expect(safe.poolPreSafePct).toBe(0.1)
    expect(safe.poolPostRoundPct).toBeCloseTo(0.0875, 12)
    expect(safe.founderBlockAfter).toBeCloseTo(0.7875, 12)
    expect(safe.founderRows[0].after).toBeCloseTo(0.39375, 12)
  })

  it('never bills founders for a pool that already existed', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0.1, newPct: 0.1 } }),
    )
    expect(safe.founderBlockBefore).toBeCloseTo(0.9, 12)
    expect(safe.founderBlockAfter).toBeCloseTo(0.7875, 12)
    // The round cost them 12.5% of what they held, not 21.25%.
    expect(safe.founderDilution).toBeCloseTo(0.125, 12)
    expect(safe.dilutionPointsFromPool).toBe(0)
  })

  it('attributes dilution to the pool and the SAFEs separately, and they reconcile', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0.05, newPct: 0.15 } }),
    )
    expect(safe.dilutionPointsFromPool).toBeCloseTo(0.1, 12)
    expect(safe.dilutionPointsFromSafes).toBeCloseTo(0.85 * 0.125, 12)
    expect(safe.dilutionPointsFromPool + safe.dilutionPointsFromSafes).toBeCloseTo(
      safe.dilutionPoints,
      12,
    )
  })

  it('flags a new-pool target that does nothing', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0.1, newPct: 0.05 } }),
    )
    expect(safe.poolIsNoOp).toBe(true)
    expect(safe.poolPreSafePct).toBe(0.1)
    expect(computeSafe(twoFounders, scenario({ investors })).safe.poolIsNoOp).toBe(false)
  })
})

describe('cap table', () => {
  const investors = [investor({ id: 'i1' }), investor({ id: 'i2' })]

  it('shows today, what is created, and after — and both columns total 100%', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0.1, newPct: 0.15 } }),
    )
    expect(sum(safe.capTable.map((r) => r.before))).toBeCloseTo(1, 12)
    expect(sum(safe.capTable.map((r) => r.after))).toBeCloseTo(1, 12)
    for (const row of safe.capTable) {
      expect(row.before + row.change).toBeCloseTo(row.after, 12)
    }
  })

  it('gives founders no new ownership and investors nothing before the round', () => {
    const { safe } = computeSafe(twoFounders, scenario({ investors }))
    const founders = safe.capTable.filter((r) => r.kind === 'founder')
    const invRows = safe.capTable.filter((r) => r.kind === 'investor')
    expect(founders.every((r) => r.newOwnership === null && r.change < 0)).toBe(true)
    expect(invRows.every((r) => r.before === 0 && r.newOwnership === r.after)).toBe(true)
  })

  it('omits the pool row entirely when there is no pool', () => {
    const { safe } = computeSafe(twoFounders, scenario({ investors }))
    expect(safe.capTable.some((r) => r.kind === 'pool')).toBe(false)
  })

  it('makes the pool row add up: today + new = after round', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0.05, newPct: 0.15 } }),
    )
    const pool = safe.capTable.find((r) => r.kind === 'pool')
    expect(pool).toBeDefined()
    expect(pool!.before + (pool!.newOwnership ?? 0)).toBeCloseTo(pool!.after, 12)
    // The new column then totals exactly what the founders lost.
    const created = sum(safe.capTable.map((r) => r.newOwnership ?? 0))
    expect(created).toBeCloseTo(safe.dilutionPoints, 12)
  })

  it('keeps the before/after ownership split consistent with the rows', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({ investors, optionPool: { currentPct: 0.1, newPct: 0.15 } }),
    )
    expect(safe.before.founders + safe.before.pool + safe.before.investors).toBeCloseTo(1, 12)
    expect(safe.after.founders + safe.after.pool + safe.after.investors).toBeCloseTo(1, 12)
    expect(safe.after.founders).toBeCloseTo(safe.founderBlockAfter, 12)
  })
})

describe('guards', () => {
  it('refuses to compute ownership without a cap', () => {
    const { safe, gates } = computeSafe(
      twoFounders,
      scenario({ investors: [investor({ postMoneyCap: 0 })] }),
    )
    expect(safe.investors[0].capInvalid).toBe(true)
    expect(safe.investors[0].ownership).toBe(0)
    expect(Number.isFinite(safe.totalSafeOwnership)).toBe(true)
    expect(gates.hasInvalidCap).toBe(true)
    expect(gates.ownershipComputable).toBe(false)
  })

  it('leaves money that bought nothing out of the blended cap', () => {
    const { safe } = computeSafe(
      twoFounders,
      scenario({
        investors: [investor({ id: 'i1' }), investor({ id: 'i2', postMoneyCap: 0 })],
      }),
    )
    // $500k converted at $8M; the other $500k bought nothing, so the blend is $8M.
    expect(safe.totalSafeOwnership).toBe(0.0625)
    expect(safe.blendedCap).toBe(8_000_000)
    expect(safe.impliedPostMoneyValuation).toBe(8_000_000)
  })

  it('ignores a missing cap on an investor who has not put money in', () => {
    const { gates } = computeSafe(
      twoFounders,
      scenario({ investors: [investor({ investment: 0, postMoneyCap: 0 })] }),
    )
    expect(gates.hasInvalidCap).toBe(false)
    expect(gates.ownershipComputable).toBe(true)
  })

  it('blocks a round that sells more than the whole company', () => {
    const { safe, gates } = computeSafe(
      twoFounders,
      scenario({
        investors: [
          investor({ id: 'i1', investment: 6_000_000, postMoneyCap: 10_000_000 }),
          investor({ id: 'i2', investment: 6_000_000, postMoneyCap: 10_000_000 }),
        ],
      }),
    )
    expect(safe.totalSafeOwnership).toBeCloseTo(1.2, 12)
    expect(gates.safeOversold).toBe(true)
    expect(gates.ownershipComputable).toBe(false)
  })

  it('blocks results when the founder split does not total 100%', () => {
    const bad = company({
      founders: [founder({ id: 'f1', equityShare: 0.5 }), founder({ id: 'f2', equityShare: 0.4 })],
    })
    expect(computeSafe(bad, scenario()).gates.founderSplitValid).toBe(false)
    expect(computeSafe(twoFounders, scenario()).gates.founderSplitValid).toBe(true)
  })

  it('tolerates a split that is off by rounding dust', () => {
    const dusty = company({
      founders: [
        founder({ id: 'f1', equityShare: 1 / 3 }),
        founder({ id: 'f2', equityShare: 1 / 3 }),
        founder({ id: 'f3', equityShare: 1 / 3 }),
      ],
    })
    expect(computeSafe(dusty, scenario()).gates.founderSplitValid).toBe(true)
  })
})
