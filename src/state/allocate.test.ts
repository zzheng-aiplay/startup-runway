import { describe, expect, it } from 'vitest'
import { investor } from '../calc/fixtures'
import { allocateInvestments } from './allocate'

const sum = (investors: { investment: number }[]) =>
  investors.reduce((acc, i) => acc + i.investment, 0)

describe('allocating a raise across investors', () => {
  it('keeps each investor’s existing share of the round', () => {
    const result = allocateInvestments(
      [investor({ id: 'a', investment: 750_000 }), investor({ id: 'b', investment: 250_000 })],
      2_000_000,
    )
    expect(result.map((i) => i.investment)).toEqual([1_500_000, 500_000])
  })

  it('always adds up to the raise, even when the split does not divide evenly', () => {
    const three = [1, 2, 3].map((n) => investor({ id: `i${n}`, investment: 100_000 }))
    const result = allocateInvestments(three, 1_000_000)
    expect(sum(result)).toBe(1_000_000)
    expect(result.map((i) => i.investment)).toEqual([333_333, 333_333, 333_334])
  })

  it('splits evenly when nobody has written a cheque yet', () => {
    const blank = [1, 2].map((n) => investor({ id: `i${n}`, investment: 0 }))
    expect(allocateInvestments(blank, 900_000).map((i) => i.investment)).toEqual([450_000, 450_000])
  })

  it('never allocates a negative cheque', () => {
    const result = allocateInvestments(
      [investor({ id: 'a', investment: 900_000 }), investor({ id: 'b', investment: 100_000 })],
      0,
    )
    expect(result.map((i) => i.investment)).toEqual([0, 0])
  })

  it('leaves an empty list alone', () => {
    expect(allocateInvestments([], 1_000_000)).toEqual([])
  })

  it('preserves every other field on the investor', () => {
    const [only] = allocateInvestments(
      [investor({ id: 'a', name: 'Angel', postMoneyCap: 12_000_000, discountRate: 0.1 })],
      500_000,
    )
    expect(only).toMatchObject({
      id: 'a',
      name: 'Angel',
      postMoneyCap: 12_000_000,
      discountRate: 0.1,
      investment: 500_000,
    })
  })
})
