import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { formatMoney, parseMoney, parsePct } from '../calc/format'
import { MathContext } from './mathContext'
import type { ModelWarning, WarningField } from '../calc/types'

/* ==========================================================================
   Shared primitives. Every feature component is built out of these, so the
   page keeps one type scale, one focus treatment, and one invisible column
   edge that every number right-aligns to.
   ========================================================================== */

/** Any numeral in the app. Tabular, lining figures — never the serif. */
export function Num({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`num ${className}`}>{children}</span>
}

// ---------------------------------------------------------------- tooltips --

export interface Glossary {
  term: string
  definition: string
  /** The same idea in the reader's own numbers. Always shown when present. */
  yours?: string
}

/** Lookup handed down from App so no component owns its own copy. */
export type GlossaryMap = Partial<Record<string, Glossary>>

export function InfoTip({ term, definition, yours }: Glossary) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [above, setAbove] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const panelId = useId()

  useLayoutEffect(() => {
    if (!open || !wrap.current) return
    const box = wrap.current.getBoundingClientRect()
    setAbove(box.bottom > window.innerHeight - 200)
  }, [open])

  // Escape closes it however it was opened — hover, focus or click. The panel
  // overlaps the fields underneath, so a keyboard user has to be able to get rid of
  // it without moving focus.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!pinned) return
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pinned])

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), 120)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    if (!pinned) timer.current = window.setTimeout(() => setOpen(false), 80)
  }

  return (
    <span ref={wrap} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className="tip-trigger"
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        aria-label={`What is ${term}?`}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={() => {
          setPinned((p) => !p)
          setOpen(true)
        }}
      >
        ?
      </button>
      {open && (
        <span
          id={panelId}
          role="tooltip"
          className="tip-panel"
          style={{
            left: 0,
            minWidth: 240,
            ...(above ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
          }}
        >
          <span className="t-th block mb-1.5">{term}</span>
          <span
            className="num block text-[13px] leading-5 text-ink-800"
            style={{ maxWidth: '40ch' }}
          >
            {definition}
          </span>
          {yours && (
            <span
              className="num mt-2 block text-[13px] leading-5 text-ink-800"
              style={{ maxWidth: '40ch' }}
            >
              <strong className="font-semibold">Yours: </strong>
              {yours}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

// ------------------------------------------------------------------ layout --

export function Section({
  eyebrow,
  title,
  deck,
  children,
  id,
}: {
  eyebrow: string
  title: string
  deck?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section className="section" id={id}>
      <header className="mb-6">
        <div className="t-eyebrow mb-1.5">{eyebrow}</div>
        <h2 className="t-section-title">{title}</h2>
        {deck && <p className="t-deck mt-1.5">{deck}</p>}
      </header>
      {children}
    </section>
  )
}

export function GroupLabel({
  children,
  action,
  tip,
}: {
  children: ReactNode
  action?: ReactNode
  tip?: Glossary
}) {
  return (
    <div
      className="flex items-baseline justify-between pb-2 mb-2"
      style={{ borderBottom: '1px solid var(--color-rule)' }}
    >
      <span className="t-group flex items-center">
        {children}
        {tip && <InfoTip {...tip} />}
      </span>
      {action}
    </div>
  )
}

export function Field({
  label,
  tip,
  children,
  echo,
  below,
}: {
  label: ReactNode
  tip?: Glossary
  children: ReactNode
  /** Small derived value shown to the right of the control. */
  echo?: ReactNode
  /** Anything that belongs under the whole row (sum lines, hints, banners). */
  below?: ReactNode
}) {
  return (
    <div>
      <div className="field">
        <label className="t-label flex items-center">
          <span>{label}</span>
          {tip && <InfoTip {...tip} />}
        </label>
        <div className="flex items-baseline justify-end gap-3">
          {echo && <span className="t-echo whitespace-nowrap">{echo}</span>}
          {children}
        </div>
      </div>
      {below}
    </div>
  )
}

// ------------------------------------------------------------------ inputs --

interface NumericInputProps {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  invalid?: boolean
  ariaLabel: string
  width?: number
  /** Rendered instead of an editable field: same column, dashed rule. */
  derived?: boolean
}

/**
 * Money field. Shows grouped dollars at rest, raw digits while focused, and
 * accepts `12k` / `1.2m` shorthand. Arrow keys step by $1k / $10k / $100k.
 */
export function MoneyInput({
  value,
  onChange,
  disabled,
  invalid,
  ariaLabel,
  width,
  derived,
}: NumericInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <span
      className="control"
      data-invalid={invalid ? 'true' : undefined}
      data-derived={derived ? 'true' : undefined}
      style={{ width: width ?? 'var(--input-w-money)' }}
    >
      <span className="t-affix">$</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={invalid ? 'true' : undefined}
        disabled={disabled || derived}
        value={draft ?? formatMoney(value).replace('$', '')}
        onFocus={(e) => {
          setDraft(value === 0 ? '' : String(Math.round(value)))
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parseMoney(e.target.value)
          if (parsed !== null) onChange(Math.max(0, parsed))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const step = e.metaKey || e.ctrlKey ? 100_000 : e.shiftKey ? 10_000 : 1_000
          const next = Math.max(0, value + (e.key === 'ArrowUp' ? step : -step))
          setDraft(String(next))
          onChange(next)
        }}
      />
    </span>
  )
}

/** Percent field. Stores decimals, shows percentages. Arrows step 0.5 / 5. */
export function PercentInput({
  value,
  onChange,
  disabled,
  invalid,
  ariaLabel,
  digits = 1,
  max = 100,
  derived,
}: NumericInputProps & { digits?: number; max?: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = Number((value * 100).toFixed(digits)).toString()

  return (
    <span
      className="control"
      data-invalid={invalid ? 'true' : undefined}
      data-derived={derived ? 'true' : undefined}
      style={{ width: 'var(--input-w-pct)' }}
    >
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={invalid ? 'true' : undefined}
        disabled={disabled || derived}
        value={draft ?? shown}
        onFocus={(e) => {
          setDraft(shown)
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parsePct(e.target.value)
          if (parsed !== null) onChange(Math.min(max / 100, Math.max(0, parsed)))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 0.5
          const pct = value * 100 + (e.key === 'ArrowUp' ? step : -step)
          const next = Math.min(max / 100, Math.max(0, pct / 100))
          setDraft(Number(next * 100).toFixed(digits))
          onChange(next)
        }}
      />
      <span className="t-affix">%</span>
    </span>
  )
}

/** Small integer field with an optional typographic prefix (`M`7, `×`2). */
export function IntInput({
  value,
  onChange,
  ariaLabel,
  prefix,
  min = 1,
  max = 120,
  width,
}: {
  value: number
  onChange: (next: number) => void
  ariaLabel: string
  prefix?: string
  min?: number
  max?: number
  width?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <span className="control" style={{ width: width ?? 'var(--input-w-int)' }}>
      {prefix && <span className="t-affix">{prefix}</span>}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value))
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          // parseFloat, not a digits-only splice: stripping the point turns "3.5"
          // into 35, which then clamps to the maximum and rewrites the whole plan.
          const n = Number.parseFloat(e.target.value.replace(/[^\d.]/g, ''))
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const step = e.shiftKey ? 6 : 1
          const next = Math.min(max, Math.max(min, value + (e.key === 'ArrowUp' ? step : -step)))
          setDraft(String(next))
          onChange(next)
        }}
      />
    </span>
  )
}

export function TextField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel: string
}) {
  return (
    <input
      type="text"
      className="text-field"
      autoComplete="off"
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Slider for feel, paired with a typeable field for precision. */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
  ticks,
  endLabels,
}: {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  ariaLabel: string
  ticks?: number[]
  endLabels?: [string, string]
}) {
  const fill = `${((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100}%`
  return (
    <div>
      <input
        type="range"
        className="slider"
        style={{ ['--fill' as string]: fill }}
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key !== 'PageUp' && e.key !== 'PageDown') return
          e.preventDefault()
          const jump = (max - min) / 6
          onChange(
            Math.round(
              Math.min(max, Math.max(min, value + (e.key === 'PageUp' ? jump : -jump))) / step,
            ) * step,
          )
        }}
      />
      {ticks && (
        <div className="relative h-5 mt-0.5">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-0 w-px h-1 bg-ink-300"
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
            />
          ))}
          {endLabels && (
            <>
              <span className="t-small num absolute left-0 top-1.5">{endLabels[0]}</span>
              <span className="t-small num absolute right-0 top-1.5">{endLabels[1]}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  sub,
  tip,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  sub?: string
  tip?: Glossary
}) {
  return (
    <div className="field" style={{ alignItems: 'start', paddingTop: 8 }}>
      <div>
        <span className="t-label flex items-center">
          {label}
          {tip && <InfoTip {...tip} />}
        </span>
        {sub && <p className="t-caption mt-0.5 max-w-[46ch]">{sub}</p>}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className="switch"
          onClick={() => onChange(!checked)}
        />
      </div>
    </div>
  )
}

export function TextButton({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" className="text-button" onClick={onClick}>
      {children}
    </button>
  )
}

// ----------------------------------------------------------------- banners --

export function Banner({
  tone,
  heading,
  children,
  live = true,
}: {
  tone: 'info' | 'warn' | 'error'
  heading?: string
  children: ReactNode
  /** Off for a banner that only restates something already announced elsewhere. */
  live?: boolean
}) {
  return (
    <div
      className="banner mt-3"
      data-tone={tone}
      role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}
    >
      <div className="t-th mb-0.5" style={{ color: 'inherit', opacity: 0.75 }}>
        {heading ?? (tone === 'error' ? 'Fix' : tone === 'warn' ? 'Check' : 'Note')}
      </div>
      <div className="num text-[12.5px] leading-[19px]">{children}</div>
    </div>
  )
}

const TONE: Record<string, 'info' | 'warn' | 'error'> = {
  error: 'error',
  warn: 'warn',
  info: 'info',
}

/** Renders the engine's warnings for one input surface, right where they belong. */
export function Warnings({
  warnings,
  field,
  max = 2,
}: {
  warnings: ModelWarning[]
  field: WarningField
  max?: number
}) {
  const mine = warnings.filter((w) => w.field === field).slice(0, max)
  if (mine.length === 0) return null
  return (
    <>
      {mine.map((w) => (
        <Banner key={w.code} tone={TONE[w.severity]}>
          {w.message}
        </Banner>
      ))}
    </>
  )
}

// -------------------------------------------------------------- disclosure --

/**
 * "Show the math". Closed by default, and every one of them opens at once when
 * the reader presses `m` — which is how you check a model before printing it.
 */
export function Disclosure({
  label = 'Show the math',
  openLabel = 'Hide the math',
  children,
}: {
  label?: string
  openLabel?: string
  children: ReactNode
}) {
  const signal = useContext(MathContext)
  const [open, setOpen] = useState(false)
  const firstSignal = useRef(signal.tick)

  useEffect(() => {
    if (signal.tick !== firstSignal.current) setOpen(signal.open)
  }, [signal])

  return (
    <div className="mt-3">
      <button type="button" className="text-button" onClick={() => setOpen((o) => !o)}>
        <span
          className="inline-block mr-1.5 text-ink-400 transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transitionDuration: '140ms' }}
        >
          ▸
        </span>
        {open ? openLabel : label}
      </button>
      {open && <div className="math-panel mt-3">{children}</div>}
    </div>
  )
}

/**
 * One formula: what it is in English, the shape of it, the same thing with your
 * numbers in it, and the answer.
 */
export function Formula({
  plain,
  symbolic,
  substituted,
  result,
}: {
  plain: string
  symbolic: string
  substituted: ReactNode
  result: string
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[13.5px] leading-[21px] text-ink-700 mb-2 max-w-[62ch]">{plain}</p>
      <div className="t-mono text-ink-500">{symbolic}</div>
      <div className="t-mono text-ink-900">{substituted}</div>
      <div
        className="t-mono text-ink-900 font-semibold mt-2 pt-2"
        style={{ borderTop: '1px solid var(--color-hairline)' }}
      >
        = {result}
      </div>
    </div>
  )
}

/** A live number inside a substituted formula line. */
export function Sub({ children }: { children: ReactNode }) {
  return <span className="math-sub num">{children}</span>
}

// ------------------------------------------------------------------- lists --

/**
 * Wraps a whole list — header, rows and the add control — so they scroll
 * sideways together on a narrow screen and stay on one alignment grid.
 */
export function ListBlock({
  children,
  minWidth,
}: {
  children: ReactNode
  /** Narrowest width the columns stay legible at, before the block scrolls. */
  minWidth: number
}) {
  return (
    <div className="list-scroll" style={{ ['--list-min' as string]: `${minWidth}px` }}>
      {children}
    </div>
  )
}

export function ListHeader({
  template,
  columns,
}: {
  template: string
  columns: (string | { label: string; align?: 'left' | 'right'; tip?: Glossary })[]
}) {
  return (
    <div className="list-head" style={{ gridTemplateColumns: template }}>
      {columns.map((c, i) => {
        const label = typeof c === 'string' ? c : c.label
        const align = typeof c === 'string' ? (i === 0 ? 'left' : 'right') : (c.align ?? 'right')
        const tip = typeof c === 'string' ? undefined : c.tip
        return (
          <span
            key={label + i}
            className="t-th flex items-center"
            style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
          >
            {label}
            {tip && <InfoTip {...tip} />}
          </span>
        )
      })}
    </div>
  )
}

export function ListRow({
  template,
  children,
}: {
  template: string
  children: ReactNode
}) {
  return (
    <div className="list-row" style={{ gridTemplateColumns: template }}>
      {children}
    </div>
  )
}

export function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="add-row" onClick={onClick}>
      <span className="text-accent mr-1.5 text-[13px]">+</span>
      <span>{label}</span>
    </button>
  )
}

export function RemoveRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="remove-row" aria-label={`Remove ${label}`} onClick={onClick}>
      ×
    </button>
  )
}

/**
 * A rule of thumb, sitting beside the field it describes. Deliberately not a
 * banner: no tint, no left rule, no icon, no colour — this is reference material a
 * founder is free to ignore, and anything louder would read as a rule.
 */
export function Typical({
  benchmark,
  show = true,
}: {
  benchmark?: { typical: string; note?: string; yours?: string; source?: string }
  show?: boolean
}) {
  if (!benchmark || !show) return null
  return (
    <p className="t-caption num mt-1 max-w-[62ch]">
      <span className="t-th" style={{ color: 'var(--color-ink-500)' }}>
        Typical
      </span>
      {/* Provenance matters — measured data and received wisdom deserve different
          amounts of trust, and both go stale — but ten sources inline would bury the
          page, so it hangs off the label. */}
      {benchmark.source && (
        <InfoTip term="Where this comes from" definition={benchmark.source} />
      )}
      <span className="ml-1.5">{benchmark.typical}</span>
      {benchmark.yours && <span className="text-ink-600"> — {benchmark.yours}.</span>}
      {benchmark.note && <span className="block text-ink-500 mt-0.5">{benchmark.note}</span>}
    </p>
  )
}

/** `4 expenses · $8,400 / mo` — the subtotal a list owes the reader. */
export function ListFooter({ children }: { children: ReactNode }) {
  return <div className="t-echo text-right mt-2">{children}</div>
}

// ------------------------------------------------------------------- stats --

export function StatCell({
  label,
  value,
  unit,
  sub,
  subTone,
  tip,
  flash,
  after,
}: {
  label: string
  value: string
  unit?: string
  sub?: ReactNode
  subTone?: 'default' | 'alarm'
  tip?: Glossary
  flash?: boolean
  after?: ReactNode
}) {
  return (
    <div data-flash={flash ? 'true' : undefined}>
      <div className="t-stat-label flex items-center">
        {label}
        {tip && <InfoTip {...tip} />}
      </div>
      <div className="mt-2.5">
        <span className="t-stat-value num">{value}</span>
        {unit && <span className="t-stat-unit num">{unit}</span>}
      </div>
      {sub && (
        <div
          className="t-stat-sub num mt-1.5"
          style={subTone === 'alarm' ? { color: 'var(--color-cash-out)' } : undefined}
        >
          {sub}
        </div>
      )}
      {after}
    </div>
  )
}
