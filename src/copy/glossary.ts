import { formatMoney, formatMonths, formatPct, formatPoints } from '../calc/format'
import type { ModelResults } from '../calc/types'

/**
 * Every explanation on the page: the term, one plain sentence, and the same idea in the
 * reader's own numbers.
 *
 * Three rules hold the file together.
 *  - `definition` uses no word that would need its own tooltip. If defining one term
 *    needs another, the sentence gets rewritten instead.
 *  - `yours` is built only out of ModelResults, and is dropped entirely rather than
 *    printed against a degenerate model. A tooltip reading "$NaN" is worse than none.
 *  - Where the model simplifies — the discount, MFN, the order the pool is created in —
 *    the tooltip says so. A simplification the reader has to find in a footnote is a
 *    simplification they will quote to an investor.
 */

export interface GlossaryEntry {
  term: string
  definition: string
  /** The reader's own numbers. InfoTip prefixes it with a bold "Yours:". */
  yours?: string
}

export type GlossaryKey =
  | 'burnRate'
  | 'runway'
  | 'cashBuffer'
  | 'currentCash'
  | 'targetRunway'
  | 'benefitsLoad'
  | 'payrollLoad'
  | 'founderSplit'
  | 'equityVsSalary'
  | 'recommendedRaise'
  | 'plannedRaise'
  | 'postMoneyCap'
  | 'effectiveCap'
  | 'discount'
  | 'mfn'
  | 'safe'
  | 'optionPoolCurrent'
  | 'optionPoolNew'
  | 'dilution'
  | 'capTable'
  | 'impliedValuation'
  | 'scenarios'
  | 'hireStartMonth'

/** `null` means the model can't say anything true here, so the key goes out without `yours`. */
function entry(term: string, definition: string, yours?: string | null): GlossaryEntry {
  return yours ? { term, definition, yours } : { term, definition }
}

export function glossary(r: ModelResults): Record<GlossaryKey, GlossaryEntry> {
  const { company, scenario } = r.inputs
  const { burn, capital, runway, safe, gates } = r
  const target = scenario.targetRunwayMonths
  const buffer = scenario.bufferMonths

  // Only a round that can actually be priced gets quoted back at the reader: one bad cap
  // or an oversold round makes every ownership sentence a lie.
  const funded = safe.investors.filter((i) => i.investment > 0 && i.effectiveCap > 0)
  const pricedRound = funded.length > 0 && !gates.safeOversold && !gates.hasInvalidCap
  // Terms typed on the shared SAFE fields before any cheque exists. Still the reader's
  // own numbers, and these fields are on screen from the first render.
  const noCheques = funded.length === 0 && !gates.hasInvalidCap
  const lead = funded[0]
  const discounted = funded.find((i) => i.discountRate > 0)
  // Several sets of terms in one round: only an average cap describes it honestly.
  const mixedTerms = funded.some(
    (i) => i.postMoneyCap !== funded[0].postMoneyCap || i.effectiveCap !== funded[0].effectiveCap,
  )
  const ownershipKnown = gates.ownershipComputable
  const runwayMonths = Number.isFinite(runway.withRaise) ? formatMonths(runway.withRaise) : null

  const paidFounder = burn.founderCosts.find((f) => f.monthlyCost > 0)
  const paidHire = burn.hireCosts.find((h) => h.monthlyCost > 0)
  const hasHires = burn.hireCosts.some((h) => h.monthlyCost > 0)
  const firstHire = r.hireEvents[0]
  const leadFounder = company.founders[0]
  const leadRow = safe.founderRows[0]
  const spending = burn.currentMonthlyBurn > 0 || capital.cashNeeded > 0

  // "You two" is the case this tool was built for; the singular and the crowd are spelled
  // out so no sentence credits a cofounder who is not on the list.
  const weHold =
    company.founders.length === 2
      ? 'You two hold'
      : company.founders.length > 2
        ? 'The founders hold'
        : 'You hold'
  const weGo =
    company.founders.length === 2
      ? 'You two go'
      : company.founders.length > 2
        ? 'The founders go'
        : 'You go'
  const between = company.founders.length > 2 ? ' between them' : ''

  let cashBufferYours: string | null = null
  if (spending && buffer <= 0) {
    cashBufferYours =
      capital.recommendedRaise > 0
        ? `You have no buffer set, so the recommended raise runs the account to zero at month ${target}.`
        : `You have no buffer set, and the cash you already hold covers month ${target}, so there is nothing here to raise.`
  } else if (spending && capital.bufferAmount > 0) {
    const left =
      runway.cashAtEndOfTargetRunway > 0
        ? ` — you reach month ${target} with ${formatMoney(runway.cashAtEndOfTargetRunway)} still in the bank`
        : ''
    // Enough cash on hand and there is no raise for the buffer to be part of.
    const sized =
      capital.recommendedRaise > 0
        ? `which is ${formatMoney(capital.bufferAmount)} of the recommended raise`
        : `which is ${formatMoney(capital.bufferAmount)} your cash on hand already covers`
    cashBufferYours = `${formatMonths(buffer)} on top of month ${target}, ${sized}${left}.`
  }

  let runwayYours: string | null = null
  if (runway.withRaise <= 0) {
    runwayYours = 'The account is empty and no raise is planned, so there is no runway to count yet.'
  } else if (runwayMonths && capital.plannedRaise <= 0) {
    runwayYours = `No raise is planned yet, so the ${runwayMonths} you have is what today's cash buys.`
  } else if (runwayMonths && company.currentCash > 0) {
    runwayYours = `With the ${formatMoney(capital.plannedRaise)} raise in the bank you have ${runwayMonths}; on today's cash alone, ${formatMonths(runway.withoutRaise)}.`
  } else if (runwayMonths) {
    runwayYours = `With the ${formatMoney(capital.plannedRaise)} raise in the bank you have ${runwayMonths}. The account is empty today, so that raise is the whole runway.`
  }

  let currentCashYours: string | null = null
  if (company.currentCash > 0 && spending && Number.isFinite(runway.withoutRaise)) {
    const effect =
      capital.recommendedRaise > 0
        ? 'and it comes straight off the recommended raise'
        : 'and it already covers this whole plan, which is why the recommendation is nothing'
    currentCashYours = `${formatMoney(company.currentCash)} on hand funds ${formatMonths(runway.withoutRaise)} on its own, ${effect}.`
  } else if (company.currentCash > 0 && spending) {
    currentCashYours =
      capital.recommendedRaise > 0
        ? `${formatMoney(company.currentCash)} on hand, and every dollar of it comes off the recommended raise.`
        : `${formatMoney(company.currentCash)} on hand, which already covers this plan.`
  } else if (company.currentCash > 0) {
    currentCashYours = `${formatMoney(company.currentCash)} on hand, with nothing in this plan spending it yet.`
  } else if (capital.recommendedRaise > 0) {
    currentCashYours = `You hold nothing yet, so the whole ${formatMoney(capital.recommendedRaise)} recommendation has to carry the plan.`
  }

  let targetRunwayYours: string | null = null
  if (capital.burnThroughRunway > 0) {
    const cost = `Reaching month ${target} costs ${formatMoney(capital.burnThroughRunway)} of spending`
    targetRunwayYours =
      runwayMonths && !runway.hitsTargetRunway && capital.plannedRaise > 0
        ? `${cost}, and the ${formatMoney(capital.plannedRaise)} you plan to raise funds ${runwayMonths} of it.`
        : `${cost}${buffer > 0 ? `, with ${formatMonths(buffer)} of buffer on top` : ''}.`
  }

  let burnYours: string | null = null
  if (burn.burnAtEndOfRunway > burn.currentMonthlyBurn) {
    burnYours = `${formatMoney(burn.currentMonthlyBurn)} a month today and ${formatMoney(burn.burnAtEndOfRunway)} by month ${target}, once every hire has started.`
  } else if (burn.currentMonthlyBurn > 0) {
    // A hire already on payroll in month 1 is part of the flat number, so it has to be
    // named — otherwise the parts do not add up to the total the reader can see.
    const parts =
      burn.breakdown.hireComp > 0
        ? `${formatMoney(burn.founderMonthlyComp)} of founder pay, ${formatMoney(burn.breakdown.hireComp)} of pay for your hires and ${formatMoney(burn.operatingMonthly)} of expenses`
        : `${formatMoney(burn.founderMonthlyComp)} of founder pay and ${formatMoney(burn.operatingMonthly)} of expenses`
    burnYours = `${formatMoney(burn.currentMonthlyBurn)} a month, flat through month ${target}: ${parts}.`
  }

  let benefitsYours: string | null = null
  if (paidFounder) {
    const together =
      burn.founderCosts.length === 2
        ? `, and both of you together are ${formatMoney(burn.founderMonthlyComp)} a month`
        : burn.founderCosts.length > 2
          ? `, and all ${burn.founderCosts.length} founders together are ${formatMoney(burn.founderMonthlyComp)} a month`
          : ''
    benefitsYours = `${formatPct(paidFounder.benefitsRate)} on top of ${formatMoney(paidFounder.annualSalary)} makes ${paidFounder.name.trim() || 'that founder'} cost ${formatMoney(paidFounder.monthlyCost)} a month${together}.`
  } else if (burn.founderCosts.length > 0) {
    const first = burn.founderCosts[0]
    benefitsYours = `Set to ${formatPct(first.benefitsRate)} on ${first.name.trim() || 'the first founder'}, which costs nothing until there is a salary to load it onto.`
  }

  const payrollYours = paidHire
    ? `At ${formatPct(company.payrollLoadRate)}, ${paidHire.headcount > 1 ? `${paidHire.headcount}× ` : ''}${paidHire.role.trim() || 'a hire'} at ${formatMoney(paidHire.annualSalary)} costs ${formatMoney(paidHire.monthlyCost)} a month.`
    : `Set to ${formatPct(company.payrollLoadRate)}, which starts costing you the month your first hire lands.`

  let founderSplitYours: string | null = null
  if (leadFounder && leadRow && gates.founderSplitValid && leadFounder.equityShare >= 0) {
    const name = leadRow.name.trim() || 'the first founder'
    founderSplitYours =
      safe.before.pool > 0
        ? `${weHold} ${formatPct(safe.founderBlockBefore, 1)} of the company${between} today, so ${name}'s ${formatPct(leadFounder.equityShare)} of that is ${formatPct(leadRow.before, 1)} of the company.`
        : `Nothing is set aside for employees yet, so what the founders own is the whole company: ${name}'s ${formatPct(leadFounder.equityShare)} is also ${formatPct(leadRow.before, 1)} of the company.`
  }

  let equityVsSalaryYours: string | null = null
  if (burn.founderMonthlyComp > 0 && burn.currentMonthlyBurn > 0) {
    const cost =
      ownershipKnown && safe.founderDilution > 0 && capital.plannedRaise > 0
        ? `, and the ${formatMoney(capital.plannedRaise)} it helps size costs you ${formatPct(safe.founderDilution, 1)} of what you own`
        : ''
    equityVsSalaryYours = `Founder pay is ${formatMoney(burn.founderMonthlyComp)} of your ${formatMoney(burn.currentMonthlyBurn)} monthly burn${cost}.`
  }

  let recommendedYours: string | null = null
  if (capital.cashNeeded > 0) {
    const spend = `${formatMoney(capital.burnThroughRunway)} of spending through month ${target}`
    const withBuffer =
      capital.bufferAmount > 0
        ? `${spend} plus ${formatMoney(capital.bufferAmount)} of buffer`
        : spend
    const lessCash =
      company.currentCash > 0 ? `, less the ${formatMoney(company.currentCash)} you hold,` : ''
    recommendedYours = `${withBuffer}${lessCash} comes to ${formatMoney(capital.recommendedRaise)}.`
  }

  let plannedYours: string | null = null
  if (capital.plannedRaise > 0 || capital.recommendedRaise > 0) {
    const against = runwayMonths
      ? `, which funds ${runwayMonths} against your ${target}-month target`
      : ''
    if (capital.recommendedRaise <= 0 && capital.cashNeeded > 0) {
      plannedYours = `You have set ${formatMoney(capital.plannedRaise)}, and the ${formatMoney(company.currentCash)} you already hold covers this plan on its own, so the recommendation is nothing.`
    } else if (capital.recommendedRaise <= 0) {
      plannedYours = `You have set ${formatMoney(capital.plannedRaise)}. This plan has nothing to spend it on yet, so there is no recommendation to hold it against.`
    } else if (capital.isOverridden && Math.abs(capital.raiseGap) > 1) {
      // formatMoney writes a negative with a hyphen, so the direction of the gap goes in words.
      plannedYours = `You have set ${formatMoney(capital.plannedRaise)} against a recommendation of ${formatMoney(capital.recommendedRaise)}, ${formatMoney(Math.abs(capital.raiseGap))} ${capital.raiseGap > 0 ? 'more' : 'less'}${against}.`
    } else {
      plannedYours = `You are on ${formatMoney(capital.plannedRaise)}, the recommended number${against}.`
    }
  }

  let capYours: string | null = null
  if (pricedRound && mixedTerms) {
    capYours = `Your caps differ, so the round averages out at ${formatMoney(safe.blendedCap)}: ${formatMoney(capital.committedFromInvestors)} of cheques converts to ${formatPct(safe.totalSafeOwnership, 1)} of the company.`
  } else if (pricedRound && lead) {
    // Ownership is worked out against the cap after the discount, so a cap quoted without
    // the discount would not divide into the percentage beside it.
    const at =
      lead.discountRate > 0
        ? `At your ${formatMoney(lead.postMoneyCap)} cap less the ${formatPct(lead.discountRate)} discount`
        : `At your ${formatMoney(lead.postMoneyCap)} cap`
    capYours = `${at}, ${formatMoney(lead.investment)} converts to ${formatPct(lead.ownership)}${funded.length > 1 ? `, and all ${formatMoney(capital.committedFromInvestors)} to ${formatPct(safe.totalSafeOwnership, 1)}` : ''}.`
  } else if (noCheques && safe.blendedCap > 0) {
    capYours = `Your cap is ${formatMoney(safe.blendedCap)}. No cheque is entered against it yet, so there is no ownership to work out.`
  }

  let effectiveCapYours: string | null = null
  if (pricedRound && discounted) {
    // With several cheques on the list, say whose discount this is.
    const whose = funded.length > 1 ? `On ${discounted.name.trim() || 'that investor'}, ` : ''
    effectiveCapYours = `${whose}${formatPct(discounted.discountRate)} off ${formatMoney(discounted.postMoneyCap)} leaves ${formatMoney(discounted.effectiveCap)}, so ${formatMoney(discounted.investment)} converts to ${formatPct(discounted.ownership)}.`
  } else if (pricedRound && mixedTerms) {
    effectiveCapYours = `No discount is set, so every effective cap is the cap you typed for that investor. Weighted by cheque size they come to ${formatMoney(safe.blendedCap)}.`
  } else if (pricedRound && lead) {
    effectiveCapYours = `No discount is set, so the effective cap is the cap you typed: ${formatMoney(lead.effectiveCap)}.`
  } else if (noCheques && safe.blendedCap > 0 && scenario.safe.discountRate <= 0) {
    effectiveCapYours = `No discount is set, so the effective cap is the ${formatMoney(safe.blendedCap)} you typed.`
  }

  let discountYours: string | null = null
  if (pricedRound && discounted) {
    discountYours = `Your ${formatPct(discounted.discountRate)} is modelled as a cap of ${formatMoney(discounted.effectiveCap)} in place of ${formatMoney(discounted.postMoneyCap)}. That holds if your next round prices at or above ${formatMoney(discounted.postMoneyCap)}; price it lower and the discount converts off that lower price and costs you more than shown here.`
  } else if (pricedRound && mixedTerms) {
    discountYours =
      'You have no discount set, so the caps you typed are doing all the work and nothing here is an approximation.'
  } else if (pricedRound && lead) {
    discountYours = `You have no discount set, so the ${formatMoney(lead.postMoneyCap)} cap is doing all the work and nothing here is an approximation.`
  } else if (noCheques) {
    discountYours =
      scenario.safe.discountRate > 0
        ? `Your terms carry a ${formatPct(scenario.safe.discountRate)} discount, which starts lowering the cap as soon as there is a cheque to convert.`
        : 'You have no discount set, so nothing on this page is an approximation.'
  }

  // MFN feeds nothing, so this one is true whatever else the model is doing.
  const mfnYours = pricedRound
    ? `MFN is ${scenario.safe.mfn ? 'on' : 'off'}, and either way these SAFEs convert to ${formatPct(safe.totalSafeOwnership, 1)} of the company. It is a note to yourselves, not a number.`
    : `MFN is ${scenario.safe.mfn ? 'on' : 'off'}, and switching it moves nothing on this page. It is a note to yourselves, not a number.`

  let safeYours: string | null = null
  if (pricedRound) {
    const capKind = discounted ? 'an effective cap of' : mixedTerms ? 'an average cap of' : 'a cap of'
    safeYours = `Your ${funded.length === 1 ? 'one cheque totals' : `${funded.length} cheques total`} ${formatMoney(capital.committedFromInvestors)} at ${capKind} ${formatMoney(safe.blendedCap)}, and would settle at ${formatPct(safe.totalSafeOwnership, 1)} of the company.`
  } else if (noCheques && safe.blendedCap > 0) {
    // No article before the cap: '$8,000,000' is read as 'eight million', so 'a' would be wrong.
    safeYours = `No cheque is entered yet, so your ${formatMoney(safe.blendedCap)} cap has promised nobody anything so far.`
  }

  let poolCurrentYours: string | null = null
  if (company.founders.length > 0) {
    poolCurrentYours =
      safe.before.pool > 0
        ? `${weHold} ${formatPct(safe.founderBlockBefore, 1)} of the company today rather than the whole thing, because ${formatPct(safe.before.pool)} is already set aside.`
        : `${weHold} all ${formatPct(safe.founderBlockBefore, 1)} of the company today, with nothing set aside yet.`
  }

  let poolNewYours: string | null = null
  if (safe.poolIsNoOp) {
    poolNewYours = `Your existing ${formatPct(safe.before.pool)} pool already meets this target, so no new pool is created.`
  } else if (safe.poolPreSafePct > 0 && !gates.safeOversold) {
    const created = `That costs you ${formatPoints(-safe.dilutionPointsFromPool)} on its own, before any SAFE converts.`
    poolNewYours =
      safe.totalSafeOwnership > 0
        ? `To leave ${formatPct(safe.poolPostRoundPct, 1)} in the pool after the round, ${formatPct(safe.poolPreSafePct)} goes in beforehand — the SAFEs dilute the pool along with you, so it has to start bigger. ${created}`
        : `Your pool is ${formatPct(safe.poolPreSafePct)} of the company and stays there until a cheque converts, which will dilute the pool along with you. ${created}`
  } else if (safe.poolPreSafePct <= 0) {
    poolNewYours = `Your target pool is ${formatPct(safe.poolPreSafePct)}, so nothing is set aside ahead of this round.`
  }

  let dilutionYours: string | null = null
  if (ownershipKnown && safe.dilutionPoints > 0) {
    dilutionYours = `${weGo} from ${formatPct(safe.founderBlockBefore, 1)} to ${formatPct(safe.founderBlockAfter, 1)}${between}, so the dilution is ${formatPoints(-safe.dilutionPoints)}, which is ${formatPct(safe.founderDilution, 1)} of what you own today.`
  } else if (ownershipKnown) {
    dilutionYours = `${weHold} ${formatPct(safe.founderBlockBefore, 1)} today and the same ${formatPct(safe.founderBlockAfter, 1)} after the round, so nothing in this plan dilutes you yet.`
  }

  let capTableYours: string | null = null
  if (ownershipKnown && (safe.after.investors > 0 || safe.after.pool > 0)) {
    const investors =
      safe.after.investors > 0 ? `, the investors ${formatPct(safe.after.investors, 1)}` : ''
    const poolAfter =
      safe.after.pool > 0 ? `, and the option pool ${formatPct(safe.after.pool, 1)}` : ''
    capTableYours = `After this round the founders hold ${formatPct(safe.after.founders, 1)}${investors}${poolAfter}.`
  } else if (ownershipKnown) {
    capTableYours = `The table has the founders at ${formatPct(safe.after.founders, 1)} before and after, because no investor and no pool has been entered.`
  }

  const impliedYours =
    pricedRound && safe.impliedPostMoneyValuation > 0
      ? `${formatMoney(capital.committedFromInvestors)} for ${formatPct(safe.totalSafeOwnership, 1)} of the company implies ${formatMoney(safe.impliedPostMoneyValuation)} for all of it.`
      : null

  const bits = [`${formatMoney(capital.plannedRaise)} raised`]
  if (runwayMonths) bits.push(`${runwayMonths} of runway`)
  if (ownershipKnown && safe.founderDilution > 0) {
    bits.push(`${formatPct(safe.founderDilution, 1)} dilution`)
  }
  const scenariosYours = `You are looking at ${scenario.label || 'this plan'}: ${bits.join(', ')}. The table at the foot of the page compares all three.`

  let hireStartYours: string | null = null
  if (firstHire) {
    hireStartYours = `Your first hire lands in month ${firstHire.month} and steps burn up by ${formatMoney(firstHire.monthlyBurnDelta)} a month. Anything starting after month ${runway.targetPlusBuffer} sits past the end of this plan, so this raise does not pay for it.`
  } else if (hasHires) {
    hireStartYours = `Every hire on your list starts after month ${runway.targetPlusBuffer}, past the end of this plan, so this raise pays for none of them.`
  } else if (burn.currentMonthlyBurn > 0) {
    hireStartYours = `You have no hires in this plan, so burn stays flat at ${formatMoney(burn.currentMonthlyBurn)} a month.`
  }

  return {
    burnRate: entry(
      'Burn rate',
      'The cash the company spends in a month: salaries and benefits plus every operating bill. There is no revenue in this model, so burn is the whole outflow.',
      burnYours,
    ),

    runway: entry(
      'Runway',
      'How many months the money in the bank lasts at your rate of spending, with nothing new coming in.',
      runwayYours,
    ),

    cashBuffer: entry(
      'Cash buffer',
      'A cushion measured in months, not dollars: the months of spending you want still sitting in the bank on the day your target runway ends. The recommended raise includes it.',
      cashBufferYours,
    ),

    currentCash: entry(
      'Cash on hand',
      'The money already in the company account today, before anything from this round lands.',
      currentCashYours,
    ),

    targetRunway: entry(
      'Target runway',
      'How long you want the money to last: the months of spending the raise is sized to cover, before the buffer is added on top.',
      targetRunwayYours,
    ),

    benefitsLoad: entry(
      'Benefits load',
      'What a salary costs on top of the salary — payroll taxes, health insurance, the rest — written as a percentage of it.',
      benefitsYours,
    ),

    payrollLoad: entry(
      'Payroll load',
      'The same taxes-and-insurance markup the founders carry, applied to the people you hire.',
      payrollYours,
    ),

    founderSplit: entry(
      'Founder split',
      "Each founder's share of what the founders own between them, not of the whole company. The share of the whole company is shown underneath each field.",
      founderSplitYours,
    ),

    equityVsSalary: entry(
      'Equity vs. salary',
      'Paying yourselves more shortens the runway, which makes the raise bigger, and a bigger raise costs more of the company. Paying yourselves less buys ownership with cash you go without today.',
      equityVsSalaryYours,
    ),

    recommendedRaise: entry(
      'Recommended raise',
      'What this plan costs: every month of spending through your target runway, plus the buffer months on top, minus the cash you already have.',
      recommendedYours,
    ),

    plannedRaise: entry(
      'Planned raise',
      'The number you actually intend to raise. Left alone it follows the recommendation; type over it to see what a different number buys.',
      plannedYours,
    ),

    postMoneyCap: entry(
      'Post-money valuation cap',
      "The highest valuation at which an investor's money turns into shares. Because the cap is post-money, their share is the cheque divided by the cap, and it stays that share however many other cheques this round takes.",
      capYours,
    ),

    effectiveCap: entry(
      'Effective cap',
      "The cap once the discount comes off it — the number an investor's share is actually worked out against.",
      effectiveCapYours,
    ),

    discount: entry(
      'Discount',
      'A percentage off the price an investor pays at your next round that sets a price. It is modelled here as an equivalent lower cap, which is right as long as that round prices at or above your cap — if it prices below, the discount comes off the lower price and costs you more than this shows.',
      discountYours,
    ),

    mfn: entry(
      'MFN clause',
      'A most-favoured-nation clause lets an investor swap their terms for the best terms you give anyone else later. It moves no number on this page, because the better terms it would inherit do not exist yet.',
      mfnYours,
    ),

    safe: entry(
      'SAFE',
      'A simple agreement for future equity: it takes the money now and settles the ownership later, at your next round that sets a price. No shares exist today, so every percentage here is an estimate of what gets issued then.',
      safeYours,
    ),

    optionPoolCurrent: entry(
      'Option pool today',
      'Shares already set aside for future employees, as a percentage of the company as it stands today.',
      poolCurrentYours,
    ),

    optionPoolNew: entry(
      'New option pool',
      'The size you want the pool to be once this round has closed, as a share of the whole company. Type 10 and it is 10% after the round: enough is set aside beforehand to survive the dilution, and that extra comes out of the existing owners rather than the incoming investors.',
      poolNewYours,
    ),

    dilution: entry(
      'Dilution',
      'The share of the company you no longer own once new shares are created. You keep every share you hold; there are more shares in total.',
      dilutionYours,
    ),

    capTable: entry(
      'Cap table',
      'The list of who owns what, before and after the round. Every line is a slice of the same whole, so the column totals 100%.',
      capTableYours,
    ),

    impliedValuation: entry(
      'Implied valuation',
      'What the caps you entered say the whole company is worth once the money is in: the amount raised divided by the share it buys.',
      impliedYours,
    ),

    scenarios: entry(
      'Scenarios',
      'Three versions of the same plan — Lean, Base, Aggressive — so you can price each hiring plan before committing to one. The founders, the expenses and the cash on hand are shared; the hires, the target and the round are what change.',
      scenariosYours,
    ),

    hireStartMonth: entry(
      'Start month',
      'The month a hire first costs money, counted from the month the raise lands. Month 1 is the first month after the money is in.',
      hireStartYours,
    ),
  }
}
