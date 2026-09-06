import { createContext } from 'react'

/**
 * Pressing `m` opens or closes every "show the math" panel at once — which is how
 * you check a model before you trust it. The tick is what the panels watch; the
 * flag is what they set themselves to.
 */
export interface MathSignal {
  tick: number
  open: boolean
}

export const MathContext = createContext<MathSignal>({ tick: 0, open: false })
