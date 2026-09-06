import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  blankExpense,
  blankFounder,
  blankHire,
  blankInvestor,
  defaultState,
} from '../calc/defaults'
import { computeModel, summarizeScenarios } from '../calc/model'
import { allocateInvestments } from './allocate'
import { STORAGE_KEY, loadPrefs, loadState, savePrefs, saveState } from './persist'
import type {
  AppState,
  CompanyInputs,
  ExpenseLine,
  Founder,
  Hire,
  Investor,
  SafeTerms,
  ScenarioId,
  ScenarioInputs,
} from '../calc/types'

function replaceById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/**
 * All app state, all in the browser. Nothing is fetched, nothing is posted, and
 * the only side effect is a localStorage write so the numbers survive a reload.
 */
export function useAppState() {
  const [state, setState] = useState<AppState>(() => loadState() ?? defaultState())
  // Another tab writing the same key means this tab's copy is stale. Adopting it
  // silently could throw away whatever is being typed here, so the page says so
  // and leaves the choice to reload.
  const [changedElsewhere, setChangedElsewhere] = useState(false)
  const [showBenchmarks, setShowBenchmarks] = useState(() => loadPrefs().showBenchmarks)

  useEffect(() => {
    savePrefs({ showBenchmarks })
  }, [showBenchmarks])

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) setChangedElsewhere(true)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const scenario = state.scenarios[state.activeScenario]

  const results = useMemo(
    () => computeModel({ company: state.company, scenario }),
    [state.company, scenario],
  )
  const scenarioRows = useMemo(() => summarizeScenarios(state), [state])

  const patchCompany = useCallback((patch: Partial<CompanyInputs>) => {
    setState((s) => ({ ...s, company: { ...s.company, ...patch } }))
  }, [])

  const patchScenario = useCallback((patch: Partial<ScenarioInputs>) => {
    setState((s) => ({
      ...s,
      scenarios: {
        ...s.scenarios,
        [s.activeScenario]: { ...s.scenarios[s.activeScenario], ...patch },
      },
    }))
  }, [])

  // -------------------------------------------------------------- founders --

  const api = useMemo(() => {
    const updateFounder = (id: string, patch: Partial<Founder>) =>
      setState((s) => ({
        ...s,
        company: { ...s.company, founders: replaceById(s.company.founders, id, patch) },
      }))

    const addFounder = () =>
      setState((s) => {
        const founder = blankFounder(s.company.founders.length + 1)
        return { ...s, company: { ...s.company, founders: [...s.company.founders, founder] } }
      })

    const removeFounder = (id: string) =>
      setState((s) => ({
        ...s,
        company: { ...s.company, founders: s.company.founders.filter((f) => f.id !== id) },
      }))

    /** The one-click exit from a split that does not total 100%. */
    const splitEvenly = () =>
      setState((s) => {
        const n = s.company.founders.length
        if (n === 0) return s
        const each = Math.floor((100 / n) * 100) / 10_000
        const founders = s.company.founders.map((f, i) => ({
          ...f,
          equityShare: i === 0 ? 1 - each * (n - 1) : each,
        }))
        return { ...s, company: { ...s.company, founders } }
      })

    // -------------------------------------------------------------- expenses --

    const updateExpense = (id: string, patch: Partial<ExpenseLine>) =>
      setState((s) => ({
        ...s,
        company: { ...s.company, expenses: replaceById(s.company.expenses, id, patch) },
      }))

    const addExpense = () =>
      setState((s) => ({
        ...s,
        company: { ...s.company, expenses: [...s.company.expenses, blankExpense()] },
      }))

    const removeExpense = (id: string) =>
      setState((s) => ({
        ...s,
        company: { ...s.company, expenses: s.company.expenses.filter((e) => e.id !== id) },
      }))

    // ----------------------------------------------------------------- hires --

    const updateHire = (id: string, patch: Partial<Hire>) =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: { ...active, hires: replaceById(active.hires, id, patch) },
          },
        }
      })

    const addHire = () =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        const nextMonth = Math.min(
          active.targetRunwayMonths,
          (active.hires.at(-1)?.startMonth ?? 0) + 3 || 3,
        )
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: { ...active, hires: [...active.hires, blankHire(nextMonth)] },
          },
        }
      })

    const removeHire = (id: string) =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: { ...active, hires: active.hires.filter((h) => h.id !== id) },
          },
        }
      })

    // ------------------------------------------------------------- the round --

    const setSafeTerms = (patch: Partial<SafeTerms>) =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        const safe = { ...active.safe, ...patch }
        // A cap or discount typed here always reaches the investors. The toggle only
        // decides whether the per-investor cap cells are editable afterwards — an
        // input that silently changes no number is worse than one that changes them all.
        const termsEdited = 'postMoneyCap' in patch || 'discountRate' in patch
        const investors =
          safe.sameTermsForAll || termsEdited
            ? active.investors.map((i) => ({
                ...i,
                postMoneyCap: safe.postMoneyCap,
                discountRate: safe.discountRate,
              }))
            : active.investors
        return {
          ...s,
          scenarios: { ...s.scenarios, [s.activeScenario]: { ...active, safe, investors } },
        }
      })

    const updateInvestor = (id: string, patch: Partial<Investor>) =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: { ...active, investors: replaceById(active.investors, id, patch) },
          },
        }
      })

    const addInvestor = () =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: {
              ...active,
              investors: [
                ...active.investors,
                blankInvestor(
                  active.investors.length + 1,
                  active.safe.postMoneyCap,
                  active.safe.discountRate,
                ),
              ],
            },
          },
        }
      })

    const removeInvestor = (id: string) =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: {
              ...active,
              investors: active.investors.filter((i) => i.id !== id),
            },
          },
        }
      })

    /** Push the shared cap onto everyone — the exit from a caps-differ warning. */
    const applySharedCap = () =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        const cap = active.investors[0]?.postMoneyCap ?? active.safe.postMoneyCap
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: {
              ...active,
              safe: { ...active.safe, postMoneyCap: cap },
              investors: active.investors.map((i) => ({ ...i, postMoneyCap: cap })),
            },
          },
        }
      })

    /** Scale the investor cheques so they add up to the planned raise exactly. */
    const matchInvestorsToRaise = (plannedRaise: number) =>
      setState((s) => {
        const active = s.scenarios[s.activeScenario]
        return {
          ...s,
          scenarios: {
            ...s.scenarios,
            [s.activeScenario]: {
              ...active,
              investors: allocateInvestments(active.investors, plannedRaise),
            },
          },
        }
      })

    const setActiveScenario = (id: ScenarioId) => setState((s) => ({ ...s, activeScenario: id }))

    const reset = () => setState(defaultState())

    return {
      updateFounder,
      addFounder,
      removeFounder,
      splitEvenly,
      updateExpense,
      addExpense,
      removeExpense,
      updateHire,
      addHire,
      removeHire,
      setSafeTerms,
      updateInvestor,
      addInvestor,
      removeInvestor,
      applySharedCap,
      matchInvestorsToRaise,
      setActiveScenario,
      reset,
    }
  }, [])

  return {
    state,
    scenario,
    results,
    scenarioRows,
    changedElsewhere,
    showBenchmarks,
    setShowBenchmarks,
    patchCompany,
    patchScenario,
    ...api,
  }
}

export type Store = ReturnType<typeof useAppState>
