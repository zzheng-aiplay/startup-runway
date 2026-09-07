# Raise & runway

A private, single-page fundraising calculator for two cofounders. Answers four questions on one
screen: what we burn each month, how much cash the plan needs, how much to raise, and what a
post-money SAFE round costs each founder.

No login, no backend, no analytics. Everything runs in the browser and the only thing it stores is
your inputs in `localStorage`.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests (vitest)
npm run build    # typecheck + production build
```

## Layout of the code

```
src/calc/          the calculation engine — pure TypeScript, no React, fully tested
  types.ts         the whole domain. Everything downstream speaks these types.
  numbers.ts       clamping, safe division, largest-remainder rounding
  format.ts        money / percent / months formatting and parsing
  burn.ts          the burn step function: founders + costs + hires by month
  capital.ts       burn through the runway, the buffer, the recommended raise
  runway.ts        the month-by-month cash simulation, chart rows, hire markers
  safe.ts          post-money SAFE dilution, option pool, cap table
  model.ts         computeModel() — the single entry point — and the warnings
  defaults.ts      the seed state for Lean / Base / Aggressive

src/state/store.ts one hook holding all app state plus every updater
src/components/    presentation only; no component computes a number
src/copy/          the words: tooltip glossary, and the "show the math" panels
```

The rule that keeps it honest: **every number the UI renders is a field on `ModelResults`.** No
component derives its own, so the stat cards, the cap table, the chart and the formula panels
cannot drift apart.

## The model

Money is a plain number of dollars. Rates are decimals (`0.0625` is 6.25%). Months are 1-indexed,
where month 1 is the first month after the money lands.

**Burn** is a step function, not a constant:

```
burn(m) = Σ founder salary/12 × (1 + their benefits)
        + Σ operating costs
        + Σ hires whose start month ≤ m, at salary/12 × headcount × (1 + payroll load)
```

**The recommended raise** is a month-by-month sum, never `burn × months`:

```
raise = Σ burn(1..N) + Σ burn(N+1..N+B) − cash on hand
```

where `N` is the target runway and `B` the buffer in months. The two windows are disjoint, so the
buffer is not double-counted, and it is priced at the burn you will have *then* — so it grows with
your hiring plan.

**Runway** simulates the balance forward and triggers on `cash(m) <= 0`, counting whole months plus
the fraction of the month the money runs out in. The `<= 0` matters: raising exactly the recommended
amount lands cash on precisely zero, and a strict `< 0` there reports an unlimited runway on the
default screen.

**SAFE dilution** (simplified post-money SAFE):

```
investor share  = investment ÷ (cap × (1 − discount))
S               = Σ investor shares
P               = max(pool today, target pool)        // as % of the pre-SAFE table
founder block   = (1 − P) × (1 − S)
pool after      = P × (1 − S)
```

Every post-round holding sums to exactly 1. Dilution is measured against what the founders own
**today** (`1 − pool today`), so a pool that existed before this round is never billed as this
round's cost. The attribution shown on screen — points lost to the new pool (`P − pool today`) plus
points lost to the SAFEs (`(1 − P) × S`) — reconciles exactly to the total.

### What it deliberately does not model

- A discount is treated as an equivalent lower cap. A real SAFE applies the discount to your next
  priced round's price and the investor takes whichever is better. So the model is right as long as
  the next round prices at or above the cap; if it prices below, the discount converts off that
  lower price and costs the founders more than the tool shows.
- The option pool is created before the SAFEs convert, so founders pay for it and incoming
  investors do not — which is why a pool typed as 10% lands smaller after the round.
- MFN, pro-rata rights, note interest, revenue, interest earned, and every term of an actual priced
  round are ignored.
- The founders plus the option pool are assumed to own 100% today.

It is a planning calculator, not legal, tax or accounting advice.

## Worked examples the tests pin

| | Input | Expected |
|---|---|---|
| A | $100k/mo burn, 18-month target, no cash | $1.8M through the runway |
| B | $500k + $500k at an $8M post-money cap | 6.25% + 6.25% = 12.5%; founders keep 87.5%, 43.75% each |
| C | $1M + $500k at a $10M cap | 10% + 5% = 15%; founders keep 85% |
| D | raise exactly the recommendation | runway is exactly N + B months, never "unlimited" |

`npm test` covers burn, hiring impact, the buffer, runway (including the exact-zero boundary),
SAFE dilution with any number of investors, founder dilution, option-pool scenarios, the cap-table
invariants, the warnings, and a no-NaN-whatever-you-type sweep.

## Typical ranges

Beside the inputs that have a convention, the page prints one quiet reference line — founder pay,
non-payroll costs, target runway, buffer, first-hire timing, payroll load, round size, valuation
cap, round dilution and the option pool. The range is always shown; a `— yours is X` clause appears
only when the plan sits well outside it.

They are **suggestions, not guardrails**: nothing is clamped, blocked or coloured as a warning, the
engine never reads them, and `Hide the typical ranges` in the footer switches them off for good. The
flag threshold is deliberately looser than the range, because being off the median is a choice.

Each range names its own source behind the `?` on the word *Typical* — they were checked against
material published between March 2025 and September 2026, and the file distinguishes measured data
(Carta cap-table and payroll data, Pilot's founder survey, Kruze's client payroll) from conventions
nobody has actually measured (the cash buffer, the per-line cost bands). Two of them moved a long
way in that window: post-money caps (pre-seed medians are now $10M–$18M, not $6M–$15M) and the true
cost of a US hire (25–35% over base salary, which is why the seeded payroll load is 25%). They live
in `src/calc/benchmarks.ts` as plain strings — edit them freely if your market says otherwise.

## Saving a plan — three ways, no server

There is no account, no database and no network request after the page loads. That is the whole
privacy design, and it is checkable by reading `src/state/`.

1. **This browser.** Every keystroke is written to `localStorage` and rebuilt field-by-field on load
   over the seed defaults, so a plan saved by an older build, or hand-edited in devtools, comes back
   with the missing parts filled in rather than blanking the page. If a render ever does fail, the
   error screen offers to clear it. Two tabs open at once notice each other rather than silently
   overwriting.
2. **A link.** `Copy a link to this plan` packs all three scenarios into the URL **fragment** —
   about 1 kB of base64url. Browsers never send a fragment to the server, so a shared plan never
   touches this site, its logs, or any third party. Opening such a link adopts the plan, strips the
   token from the URL so a refresh cannot re-apply it, and offers to put the displaced plan back.
3. **A file.** `Download it as a file` writes readable JSON you can archive, diff or commit next to
   a board deck. `Open a plan file` reads it back.

What that buys, and what it does not: a plan link is exactly as private as wherever you paste it,
and it sits in your browser history. Nothing is encrypted — that would mean key management, and
these are burn numbers. Anything arriving from a link or a file is untrusted input and goes through
the same validator as the saved plan (`reviveState`), so a hostile or truncated payload degrades to
the default plan instead of reaching the engine; names are length-capped and only ever rendered as
text. `src/state/share.test.ts` covers the round trip and the hostile cases.

## Keyboard

- `1` / `2` / `3` — switch between Lean / Base / Aggressive
- `m` — open or close every "show the math" panel at once
- `↑` / `↓` in any amount — step by $1,000; `Shift` for $10,000; `⌘`/`Ctrl` for $100,000
- `↑` / `↓` in any percentage — step by 0.5; `Shift` for 5

Amount fields also accept `12k` and `1.2m` shorthand.

## Extending it

The engine is modular on purpose. To add a pre-money SAFE, a priced round, or a proper
discount-versus-cap comparison, add a branch in `src/calc/safe.ts` keyed off
`ScenarioInputs.safe.safeType` and extend `SafeResults` — the UI reads only the result fields, so
nothing else has to change. Add the corresponding tests next to `safe.test.ts`.

## License

MIT — see [LICENSE](LICENSE). It is a planning calculator, not legal, tax or accounting advice, and
it comes with no warranty; the model's simplifications are listed above and in the app itself.
