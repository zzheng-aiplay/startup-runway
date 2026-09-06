import { clamp, nonNegative, safeDiv, sum } from './numbers'
import type {
  CapTableRow,
  CompanyInputs,
  InvestorResult,
  ModelGates,
  OwnershipSplit,
  SafeResults,
  ScenarioInputs,
} from './types'

/** Founder splits must total 100% within half a basis point. */
export const SPLIT_TOLERANCE = 0.0005
/** Total SAFE ownership at or above this is impossible, not just aggressive. */
export const OVERSOLD_THRESHOLD = 1 - 1e-9
/** Above this, worth saying out loud for a pre-seed round. */
export const HIGH_DILUTION_THRESHOLD = 0.3
/** A discount above this is almost certainly a percent-vs-decimal typo. */
export const MAX_DISCOUNT = 0.5

/**
 * Simplified post-money SAFE + option pool model.
 *
 *   investor %      = investment / (cap × (1 - discount))
 *   S               = Σ investor %
 *   P               = max(pool today, target pool)      // pool as % of the pre-SAFE table
 *   founder block   = (1 - P) × (1 - S)
 *   pool after      = P × (1 - S)
 *
 * Every post-round holding sums to exactly 1. Dilution is always measured against what
 * the founders own *today* (1 - pool today), never against a fictional 100%, so a pool
 * that existed before this round is never billed as this round's cost.
 */
export function computeSafe(
  company: CompanyInputs,
  scenario: ScenarioInputs,
): { safe: SafeResults; gates: ModelGates } {
  const investors: InvestorResult[] = scenario.investors.map((inv) => {
    const investment = nonNegative(inv.investment)
    const postMoneyCap = nonNegative(inv.postMoneyCap)
    const discountRate = clamp(nonNegative(inv.discountRate), 0, MAX_DISCOUNT)
    const effectiveCap = postMoneyCap * (1 - discountRate)
    const capInvalid = !(effectiveCap > 0) && investment > 0
    const ownership = effectiveCap > 0 ? investment / effectiveCap : 0
    return {
      id: inv.id,
      name: inv.name,
      investment,
      postMoneyCap,
      discountRate,
      effectiveCap,
      ownership,
      capInvalid,
      oversold: ownership >= OVERSOLD_THRESHOLD,
    }
  })

  const totalSafeOwnership = sum(investors.map((i) => i.ownership))
  // Only money that actually converts belongs in a blended cap: a cheque sitting
  // against a missing cap bought no ownership, and counting it would inflate the
  // implied valuation to twice the only real cap on the page.
  const priced = sum(investors.filter((i) => i.effectiveCap > 0).map((i) => i.investment))

  const poolToday = clamp(nonNegative(scenario.optionPool.currentPct), 0, 0.95)
  const poolTarget = clamp(nonNegative(scenario.optionPool.newPct), 0, 0.95)
  const poolPreSafePct = Math.max(poolToday, poolTarget)
  const poolIncrementPct = poolPreSafePct - poolToday
  const poolPostRoundPct = poolPreSafePct * (1 - totalSafeOwnership)

  const founderShareSum = sum(company.founders.map((f) => nonNegative(f.equityShare)))
  const founderSplitValid =
    company.founders.length > 0 && Math.abs(founderShareSum - 1) <= SPLIT_TOLERANCE
  const hasInvalidCap = investors.some((i) => i.capInvalid)
  const safeOversold = totalSafeOwnership >= OVERSOLD_THRESHOLD

  const founderBlockBefore = 1 - poolToday
  const founderBlockAfter = (1 - poolPreSafePct) * (1 - totalSafeOwnership)

  const founderRows = company.founders.map((f) => {
    const share = nonNegative(f.equityShare)
    return {
      id: f.id,
      name: f.name,
      before: share * founderBlockBefore,
      after: share * (1 - poolPreSafePct) * (1 - totalSafeOwnership),
    }
  })

  const capTable: CapTableRow[] = founderRows.map((row) => ({
    id: row.id,
    holder: row.name,
    kind: 'founder' as const,
    before: row.before,
    newOwnership: null,
    after: row.after,
    change: row.after - row.before,
  }))

  for (const inv of investors) {
    capTable.push({
      id: inv.id,
      holder: inv.name,
      kind: 'investor',
      before: 0,
      newOwnership: inv.ownership,
      after: inv.ownership,
      change: inv.ownership,
    })
  }

  if (poolToday > 0 || poolPreSafePct > 0) {
    capTable.push({
      id: 'option-pool',
      holder: 'Employee option pool',
      kind: 'pool',
      before: poolToday,
      // The post-round delta, not the pre-SAFE increment: every other row satisfies
      // today + new = after, and the pool row has to as well.
      newOwnership: poolPostRoundPct - poolToday > 0 ? poolPostRoundPct - poolToday : null,
      after: poolPostRoundPct,
      change: poolPostRoundPct - poolToday,
    })
  }

  const before: OwnershipSplit = { founders: founderBlockBefore, investors: 0, pool: poolToday }
  const after: OwnershipSplit = {
    founders: founderBlockAfter,
    investors: totalSafeOwnership,
    pool: poolPostRoundPct,
  }

  const blendedCap =
    totalSafeOwnership > 0
      ? safeDiv(priced, totalSafeOwnership)
      : nonNegative(scenario.safe.postMoneyCap)

  const safe: SafeResults = {
    investors,
    totalSafeOwnership,
    poolPreSafePct,
    poolPostRoundPct,
    poolIncrementPct,
    poolIsNoOp: poolToday > 0 && poolTarget <= poolToday,
    founderBlockBefore,
    founderBlockAfter,
    founderDilution:
      founderBlockBefore > 0 ? 1 - founderBlockAfter / founderBlockBefore : 0,
    dilutionPoints: founderBlockBefore - founderBlockAfter,
    dilutionPointsFromPool: poolIncrementPct,
    dilutionPointsFromSafes: (1 - poolPreSafePct) * totalSafeOwnership,
    impliedPostMoneyValuation: totalSafeOwnership > 0 ? safeDiv(priced, totalSafeOwnership) : 0,
    blendedCap,
    capTable,
    before,
    after,
    founderRows,
  }

  return {
    safe,
    gates: {
      founderSplitValid,
      hasInvalidCap,
      safeOversold,
      ownershipComputable: founderSplitValid && !hasInvalidCap && !safeOversold,
      blockOwnershipComputable: !hasInvalidCap && !safeOversold,
    },
  }
}
