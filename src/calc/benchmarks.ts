import { formatMoney, formatMonths, formatPct } from './format'
import { nonNegative, positiveInt, sum } from './numbers'
import type { ModelResults } from './types'

/* ==========================================================================
   What is normal, for reference only.

   Nothing here gates, clamps or blocks a single input. Each range renders as one
   quiet line beside the field it describes: the range is always shown, and a
   "yours" clause appears only when the plan sits *well* outside it — the flag is
   deliberately looser than the range, because being off the median is a choice,
   not an error.

   Every line carries where it came from and as of when, because some of these are
   measured data (Carta cap-table and payroll data, Pilot's founder survey, Kruze's
   client payroll) and some are received wisdom that no one has actually measured.
   Those deserve different amounts of trust. Checked against sources published
   between March 2025 and September 2026.
   ========================================================================== */

export type BenchmarkCode =
  | 'founderPay'
  | 'operatingCosts'
  | 'targetRunway'
  | 'buffer'
  | 'firstHire'
  | 'payrollLoad'
  | 'raiseSize'
  | 'cap'
  | 'roundDilution'
  | 'optionPool'

export interface Benchmark {
  code: BenchmarkCode
  /** The convention. Always shown. */
  typical: string
  /** At most one clause on why it is the convention. */
  note?: string
  /** Only when this plan sits well outside the range. Never phrased as an error. */
  yours?: string
  /**
   * Where the range comes from and as of when — so a reader can tell measured data
   * from received wisdom, and can tell how stale it is. Shown in small print.
   */
  source?: string
}

/** Per-line cost ranges, for the "what do these usually cost?" disclosure. */
export const COST_RANGES: { name: string; range: string; note?: string }[] = [
  {
    name: 'Cloud / infrastructure',
    range: '$200 – $2,000 / mo',
    note: 'Often near zero for the first year on AWS Activate or GCP credits.',
  },
  {
    name: 'AI / LLM / API',
    range: '$200 – $5,000 / mo',
    note: 'The most volatile line on a 2026 plan. Kruze finds AI startups spend roughly twice what SaaS startups do on compute, and that it has grown from 24% to 50% of revenue for their AI clients.',
  },
  { name: 'Software / SaaS', range: '$50 – $150 per person / mo' },
  {
    name: 'Legal & accounting',
    range: '$500 – $2,000 / mo',
    note: 'Plus roughly $2,000 – $5,000 once, for incorporation and the SAFE paperwork.',
  },
  {
    name: 'Insurance',
    range: '$100 – $600 / mo',
    note: 'D&O, E&O and general liability. Median D&O alone is about $1,240 a year, or $103 a month.',
  },
  {
    name: 'Office / coworking',
    range: '$0 – $500 per person / mo',
    note: 'Most pre-seed teams are remote and spend nothing here.',
  },
  { name: 'Marketing', range: '$0 – $2,000 / mo', note: 'Usually near zero before product-market fit.' },
  { name: 'Travel', range: '$0 – $1,000 / mo' },
]

function clause(parts: (string | null)[]): string | undefined {
  const live = parts.filter((p): p is string => Boolean(p))
  return live.length > 0 ? live.join(' · ') : undefined
}

export function benchmarks(r: ModelResults): Record<BenchmarkCode, Benchmark> {
  const { company, scenario } = r.inputs
  const target = positiveInt(scenario.targetRunwayMonths)
  const buffer = Math.max(0, Math.round(scenario.bufferMonths) || 0)
  const paid = r.burn.founderCosts.filter((f) => f.annualSalary > 0)
  const topSalary = paid.length > 0 ? Math.max(...paid.map((f) => f.annualSalary)) : 0
  const benefits = company.founders.map((f) => nonNegative(f.benefitsRate))
  const load = nonNegative(company.payrollLoadRate)
  const payrollShare =
    r.burn.currentMonthlyBurn > 0
      ? (r.burn.currentMonthlyBurn - r.burn.operatingMonthly) / r.burn.currentMonthlyBurn
      : 0
  const hires = r.burn.hireCosts.filter((h) => h.headcount > 0 && h.annualSalary > 0)
  const firstHire = hires.length > 0 ? Math.min(...hires.map((h) => h.startMonth)) : null
  const hireSalaries = hires.map((h) => h.annualSalary)
  const funded = r.safe.investors.filter((i) => i.investment > 0 && i.effectiveCap > 0)
  const cap = r.safe.blendedCap

  return {
    founderPay: {
      code: 'founderPay',
      typical:
        'US founder pay averaged $118,000 in 2026, but it tracks team size closely: about $75,000 under five people, $112,000 at six to ten. Roughly one founder in eleven still pays themselves nothing.',
      note: 'Add the payroll load on top — that is a separate 25 – 35% (see the hiring step).',
      source:
        'Pilot Founder Salary Report 2026 (1,600+ founders, July 2026): $118,000 average, up from $98,000 in 2025; $158,000 in San Francisco, $122,000 in New York, $96,000 in Texas; 9.1% take $0. Kruze client payroll, September 2026, puts seed-stage CEOs higher at $153,000 — that data only sees founders who are on payroll at all.',
      yours: clause([
        paid.length === 0 && company.founders.length > 0
          ? 'you have every founder at $0, which is common — it just leaves the real cost of the plan out of the burn'
          : null,
        topSalary > 200_000 ? `your highest is ${formatMoney(topSalary)}` : null,
        benefits.some((b) => b > 0.35) ? 'your benefits load is above 35%' : null,
        benefits.every((b) => b < 0.1) && paid.length > 0
          ? 'your benefits load is under 10%, which usually means payroll taxes are not in there'
          : null,
      ]),
    },

    operatingCosts: {
      code: 'operatingCosts',
      typical:
        'People are normally 65 – 85% of a startup\u2019s burn. Everything else for a small team tends to land between $3,000 and $12,000 a month.',
      source:
        'Kruze Consulting, November 2024, across $900M+ of spending at 100+ funded startups: payroll was 76.4% of operating costs. Their February 2026 forecasting guidance says 60 – 80%. The dollar band is a rule of thumb — no source publishes a measured figure for it.',
      yours: clause([
        r.burn.operatingMonthly > 0 && r.burn.operatingMonthly < 3_000
          ? `yours are ${formatMoney(r.burn.operatingMonthly)}`
          : null,
        r.burn.operatingMonthly > 12_000 ? `yours are ${formatMoney(r.burn.operatingMonthly)}` : null,
        r.burn.currentMonthlyBurn > 0 && payrollShare < 0.55
          ? `people are ${formatPct(payrollShare, 0)} of your burn, so something else is carrying it`
          : null,
      ]),
    },

    targetRunway: {
      code: 'targetRunway',
      typical:
        '18 – 24 months is the usual target between a pre-seed and a seed, and recent data favours the top of that band over the bottom.',
      note: 'An efficient raise runs 2 – 5 months from first meeting to money in the bank, so most teams start with six or more months left.',
      source:
        'Kruze Consulting, January 2026, names 18 – 24 months as the target and 8 – 12 weeks as the active pitching window, calling six months or more a stall. Pilot, April 2026, across ~1,000 VC-backed companies, found 12 – 23 months of runway was the worst-performing band on burn-to-growth and 24+ months the best.',
      yours: clause([
        target < 12 ? `yours is ${target} months` : null,
        target > 30 ? `yours is ${target} months, which is a long way to plan pre-product` : null,
      ]),
    },

    buffer: {
      code: 'buffer',
      typical: '3 – 6 months of buffer on top of the target is the usual advice.',
      source:
        'A convention rather than a measured statistic — no source publishes buffer data. It exists because a raise takes months and slips.',
      yours: clause([
        buffer < 3 ? `yours is ${formatMonths(buffer)}` : null,
        buffer > 9 ? `yours is ${formatMonths(buffer)}` : null,
      ]),
    },

    firstHire: {
      code: 'firstHire',
      typical:
        firstHire === null
          ? 'Plenty of pre-seed teams stay founders-only until the seed. Across Carta\u2019s data the first hire lands a median of seven to nine months after incorporation, and that has been getting later, not earlier.'
          : 'A founding engineer is normally $120,000 – $185,000 plus 0.5 – 4% of the company, with a median first grant near 1.5%.',
      note:
        firstHire === null
          ? undefined
          : 'Carta measures the first hire at a median of seven to nine months from incorporation — a different clock from your month 1, which is when the money lands.',
      source:
        'Carta, Winter 2025 State of Seed (50,000 startups): median days to first hire rose from 214 in the 2019 cohort to 284 in the 2024 cohort. First-grant equity from 8,000+ initial grants: 0.5 – 4%, median 1.49%; senior AI/ML equity up 15 – 40% since January 2024. Salary band from Kruze\u2019s September 2026 compensation guide (San Francisco senior engineer $140,000 – $185,000).',
      yours: clause([
        firstHire !== null && firstHire < 2 ? `yours starts in month ${firstHire}` : null,
        firstHire !== null && firstHire > 12 ? `yours starts in month ${firstHire}` : null,
        hireSalaries.some((s) => s > 220_000)
          ? `your highest is ${formatMoney(Math.max(...hireSalaries))}`
          : null,
      ]),
    },

    payrollLoad: {
      code: 'payrollLoad',
      typical:
        '25 – 35% on top of salary covers a US hire fully: benefits are 15 – 25% of that and employer payroll taxes are most of the rest.',
      source:
        'Kruze Consulting: benefits run about 20% of salary (October 2025); benefits 8.2% of wages plus 7.6% employer payroll taxes make a hire 17 – 30% more expensive (November 2024); their September 2026 guide puts total cost 25 – 35% above base, matching the SBA\u2019s 1.25 – 1.4x rule of thumb.',
      yours: clause([
        load < 0.15 ? `yours is ${formatPct(load, 0)}` : null,
        load > 0.45 ? `yours is ${formatPct(load, 0)}` : null,
      ]),
    },

    raiseSize: {
      code: 'raiseSize',
      typical:
        'Pre-seed rounds are usually $500,000 – $3,000,000 in total, though the individual cheques inside one are much smaller — the average SAFE was $276,000.',
      source:
        'Carta, State of Pre-Seed Q2 2026: average instrument size $276,000, up 27% year on year to a record; $3.19B raised across 11,546 instruments in the quarter.',
      yours: clause([
        r.capital.plannedRaise > 0 && r.capital.plannedRaise < 250_000
          ? `yours is ${formatMoney(r.capital.plannedRaise)}`
          : null,
        r.capital.plannedRaise > 5_000_000
          ? `yours is ${formatMoney(r.capital.plannedRaise)}, which is seed-sized`
          : null,
      ]),
    },

    cap: {
      code: 'cap',
      typical:
        'Post-money caps have moved up. Pre-seed medians now run $10,000,000 – $18,000,000 depending on round size, and $35,000,000 for rounds above $2,500,000. Seed medians sit near $20,000,000 – $24,000,000.',
      source:
        'Carta, State of Pre-Seed Q2 2026: median caps of $10M under $250k raised, $12.5M at $500k – $999k, $18M at $1M – $2.4M, $35M at $2.5M+. Caps rose in every size bracket quarter on quarter. Seed medians from Carta Winter 2025 ($20M) and Q4 2025 ($24M), with a long AI-driven tail — 95th percentile $80.5M.',
      yours: clause([
        funded.length > 0 && cap > 0 && cap < 6_000_000 ? `yours is ${formatMoney(cap)}` : null,
        funded.length > 0 && cap > 60_000_000
          ? `yours is ${formatMoney(cap)}, which is priced-round territory`
          : null,
      ]),
    },

    roundDilution: {
      code: 'roundDilution',
      typical:
        'A pre-seed usually costs 10 – 20% of the company: a median of 10.8% for rounds of $500,000 – $999,000 and 15.5% at $1,000,000 – $2,400,000. Above $2,500,000 it typically passes 20%.',
      note: 'Founders who still hold more than half after a Series A almost always kept the pre-seed under 20%.',
      source:
        'Carta, State of Pre-Seed Q2 2026, median expected cumulative dilution by round size: 2.1% under $250k, 6.4% at $250k – $499k, 10.8% at $500k – $999k, 15.5% at $1M – $2.4M (interquartile 9.7 – 24%), 20.6% at $2.5M – $4.9M, 23.3% above $5M.',
      yours: clause([
        funded.length > 0 && r.gates.blockOwnershipComputable && r.safe.totalSafeOwnership < 0.08
          ? `yours is ${formatPct(r.safe.totalSafeOwnership, 1)}`
          : null,
        r.gates.blockOwnershipComputable && r.safe.totalSafeOwnership > 0.25
          ? `yours is ${formatPct(r.safe.totalSafeOwnership, 1)}`
          : null,
      ]),
    },

    optionPool: {
      code: 'optionPool',
      typical:
        'By the seed round the pool is usually 10 – 15%. Many pre-seed teams leave it at 0 and create it at the priced round instead.',
      source:
        'A long-standing convention rather than a figure anyone publishes per stage. Carta\u2019s measured first-grant sizes (median 1.49%, then 0.85%, 0.50%) are what a pool of that size is actually spent on.',
      note: 'Created before the SAFEs convert, as it is here, the founders pay for all of it.',
      yours: clause([
        r.safe.poolPreSafePct > 0.2 ? `yours is ${formatPct(r.safe.poolPreSafePct, 1)}` : null,
      ]),
    },
  }
}

/** Closing line for the cost disclosure. */
export function costRangeTotal(): string {
  return '$3,000 – $12,000 / mo all in'
}

/** Said once under the cost list, because these bands are the least evidenced set here. */
export const COST_RANGE_CAVEAT =
  'These per-line bands are rules of thumb rather than published data — the only measured figures behind them are the AI-compute trend and the median D&O premium.'

/** Used by the assumptions block so the ranges are labelled for what they are. */
export const BENCHMARK_DISCLAIMER =
  'The “typical” ranges are rules of thumb for US pre-seed rounds in 2025–26, not data about your market or your team. Every one of them is a reasonable thing to ignore with a reason.'

export function benchmarkList(r: ModelResults): Benchmark[] {
  return Object.values(benchmarks(r))
}

/** How many of the plan's numbers currently sit outside their usual range. */
export function outsideTypical(r: ModelResults): number {
  return sum(benchmarkList(r).map((b) => (b.yours ? 1 : 0)))
}
