/**
 * How the page addresses the founders. The tool is built for two cofounders and
 * says so, but it accepts one to four — so the phrasing is derived rather than
 * hardcoded, or the sentences start telling a solo founder about "the two of you".
 */

const LOWER: Record<number, string> = {
  1: 'you',
  2: 'the two of you',
  3: 'the three of you',
  4: 'the four of you',
  5: 'the five of you',
  6: 'the six of you',
}

/** `the two of you` — mid-sentence. Falls back to `the founders` past six. */
export function founderPhrase(count: number): string {
  return LOWER[count] ?? 'the founders'
}

/** `The two of you` — sentence-initial. */
export function FounderPhrase(count: number): string {
  const phrase = founderPhrase(count)
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/** ` together`, but only when there is more than one of them. */
export function togetherIfPlural(count: number): string {
  return count > 1 ? ' together' : ''
}
