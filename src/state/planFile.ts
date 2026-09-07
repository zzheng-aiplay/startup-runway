import type { AppState } from '../calc/types'
import { reviveState } from './persist'
import { decodePlanArray, packPlan } from './share'

/**
 * A plan as a file on your own disk. No upload, no share target, no third party:
 * the download is generated in the page and the read happens in the page.
 *
 * The file is readable JSON on purpose — it is small enough to skim, diff and
 * commit next to a board deck, and being able to see exactly what leaves the app
 * is the whole point of a tool that promises to keep your numbers to itself.
 */

const FILENAME = 'runway-plan.json'

export function planFileContents(state: AppState): string {
  return `${JSON.stringify({ plan: packPlan(state) }, null, 2)}\n`
}

export function downloadPlan(state: AppState): void {
  const blob = new Blob([planFileContents(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = FILENAME
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Anything a file can contain is untrusted, so it goes through the same validator
 * as a saved plan: a wrong shape comes back as null and a partly-wrong one is
 * repaired over the defaults rather than reaching the engine.
 */
export async function readPlanFile(file: File): Promise<AppState | null> {
  try {
    const parsed = JSON.parse(await file.text()) as { plan?: unknown }
    if (!parsed || typeof parsed !== 'object') return null
    // A file written by this app wraps the packed array; accept a bare state too,
    // so a hand-edited or older export still opens.
    if (Array.isArray(parsed.plan)) return decodePlanArray(parsed.plan)
    return reviveState(parsed)
  } catch {
    return null
  }
}
