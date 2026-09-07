import type { Theme } from '../state/persist'

/**
 * Light or dark, and it starts on whatever the machine is set to. The label names
 * the mode you would be switching *to*, so the button says what it does rather
 * than what it is.
 */
export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme
  onChange: (next: Theme) => void
}) {
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="quiet-button"
      style={{ height: 28, paddingInline: 10, fontSize: 12 }}
      onClick={() => onChange(next)}
      title={`Switch to ${next} mode`}
    >
      <span aria-hidden className="glyph">
        {next === 'dark' ? '☾' : '☀'}
      </span>
      {next === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
