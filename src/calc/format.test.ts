import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatMoneyCompact,
  formatMonths,
  formatPct,
  parseMoney,
  parsePct,
} from './format'
import { roundSharesToTotal } from './numbers'

describe('money', () => {
  it('groups whole dollars', () => {
    expect(formatMoney(28_500)).toBe('$28,500')
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(-1_200)).toBe('-$1,200')
  })

  it('abbreviates headline numbers', () => {
    expect(formatMoneyCompact(2_100_000)).toBe('$2.1M')
    expect(formatMoneyCompact(1_000_000)).toBe('$1M')
    expect(formatMoneyCompact(973_500)).toBe('$974K')
    expect(formatMoneyCompact(1_500)).toBe('$1.5K')
    expect(formatMoneyCompact(500)).toBe('$500')
  })

  it('parses what founders actually type', () => {
    expect(parseMoney('$1,200')).toBe(1_200)
    expect(parseMoney('500k')).toBe(500_000)
    expect(parseMoney('1.5M')).toBe(1_500_000)
    expect(parseMoney('2 m')).toBe(2_000_000)
    expect(parseMoney('8000000')).toBe(8_000_000)
  })

  it('returns null mid-edit instead of snapping the field to zero', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('$')).toBeNull()
    expect(parseMoney('-')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
  })
})

describe('percentages', () => {
  it('prints ownership the way a cap table does', () => {
    expect(formatPct(0.0625)).toBe('6.25%')
    expect(formatPct(0.4375)).toBe('43.75%')
    expect(formatPct(0.5)).toBe('50%')
    expect(formatPct(0.125, 1)).toBe('12.5%')
  })

  it('parses with or without the sign', () => {
    expect(parsePct('6.25%')).toBe(0.0625)
    expect(parsePct('15')).toBe(0.15)
    expect(parsePct(' 20 % ')).toBe(0.2)
    expect(parsePct('')).toBeNull()
  })
})

describe('months', () => {
  it('reads as a sentence', () => {
    expect(formatMonths(18)).toBe('18 months')
    expect(formatMonths(21.4953)).toBe('21.5 months')
    expect(formatMonths(1)).toBe('1 month')
  })

  it('never prints the display cap as if it were a result', () => {
    expect(formatMonths(400)).toBe('120+ months')
    expect(formatMonths(Number.POSITIVE_INFINITY)).toBe('unlimited')
  })
})

describe('largest-remainder rounding', () => {
  it('keeps a displayed column at exactly 100%', () => {
    expect(roundSharesToTotal([0.4375, 0.4375, 0.0625, 0.0625])).toEqual([43.75, 43.75, 6.25, 6.25])
    const thirds = roundSharesToTotal([1 / 3, 1 / 3, 1 / 3], 1)
    expect(thirds).toEqual([33.4, 33.3, 33.3])
    expect(thirds.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9)
    const messy = roundSharesToTotal([0.39375, 0.39375, 0.0625, 0.0625, 0.0875], 1)
    expect(messy.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9)
  })

  it('handles the empty and single-holder cases', () => {
    expect(roundSharesToTotal([])).toEqual([])
    expect(roundSharesToTotal([1])).toEqual([100])
  })
})
