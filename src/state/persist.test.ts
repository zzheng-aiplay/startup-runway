import { describe, expect, it } from 'vitest'
import { defaultState } from '../calc/defaults'
import { reviveState } from './persist'

describe('reviving a saved plan', () => {
  it('round-trips the seed state unchanged', () => {
    const seed = defaultState()
    expect(reviveState(JSON.parse(JSON.stringify(seed)))).toEqual(seed)
  })

  it('fills in a scenario written by an older build that had no SAFE terms', () => {
    const seed = defaultState()
    const older = JSON.parse(JSON.stringify(seed))
    delete older.scenarios.base.safe
    const revived = reviveState(older)
    expect(revived.scenarios.base.safe).toEqual(seed.scenarios.base.safe)
  })

  it('replaces an unknown active scenario rather than crashing on it', () => {
    const revived = reviveState({ ...defaultState(), activeScenario: 'custom' })
    expect(revived.activeScenario).toBe('base')
  })

  it('survives nonsense in every field', () => {
    const revived = reviveState({
      company: { founders: 'nope', expenses: 7, currentCash: 'lots', payrollLoadRate: null },
      scenarios: { base: { targetRunwayMonths: 'soon', investors: [{}, 'x'] }, lean: 42 },
      activeScenario: 99,
    })
    const seed = defaultState()
    expect(revived.company.founders).toEqual(seed.company.founders)
    expect(revived.company.currentCash).toBe(seed.company.currentCash)
    expect(revived.scenarios.lean).toEqual(seed.scenarios.lean)
    expect(revived.scenarios.base.targetRunwayMonths).toBe(seed.scenarios.base.targetRunwayMonths)
    expect(revived.scenarios.base.investors).toHaveLength(1)
    expect(revived.activeScenario).toBe('base')
  })

  it('keeps a plan that is merely partial', () => {
    const revived = reviveState({
      company: { currentCash: 250_000 },
      scenarios: { aggressive: { targetRunwayMonths: 30 } },
      activeScenario: 'aggressive',
    })
    expect(revived.company.currentCash).toBe(250_000)
    expect(revived.scenarios.aggressive.targetRunwayMonths).toBe(30)
    expect(revived.activeScenario).toBe('aggressive')
  })

  it('gives every revived row an id', () => {
    const revived = reviveState({
      scenarios: { base: { investors: [{ investment: 1 }, { investment: 2 }] } },
    })
    const ids = revived.scenarios.base.investors.map((i) => i.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((id) => id.length > 0)).toBe(true)
  })
})
