import { nonNegative } from '../calc/numbers'
import type { Investor } from '../calc/types'

/**
 * Split a raise across the investor list in whole dollars, keeping each
 * investor's existing share of the round and giving the rounding remainder to
 * the last one — so the cheques always add up to the raise exactly, which is the
 * whole point of the button that calls this.
 *
 * An empty list, or a list where nobody has written a cheque yet, splits evenly.
 */
export function allocateInvestments(investors: Investor[], plannedRaise: number): Investor[] {
  const raise = Math.round(nonNegative(plannedRaise))
  const count = investors.length
  if (count === 0) return investors

  const amounts = investors.map((i) => nonNegative(i.investment))
  const total = amounts.reduce((a, b) => a + b, 0)

  let allocated = 0
  return investors.map((investor, index) => {
    if (index === count - 1) return { ...investor, investment: Math.max(0, raise - allocated) }
    const share = total > 0 ? amounts[index] / total : 1 / count
    const amount = Math.round(share * raise)
    allocated += amount
    return { ...investor, investment: amount }
  })
}
