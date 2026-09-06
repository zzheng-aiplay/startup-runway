import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearState } from '../state/persist'

/**
 * The saved plan is the one thing that can poison a load, and a blank page that
 * survives every reload is the worst possible failure for a tool someone is using
 * mid-fundraise. So the last resort is reachable: clear the saved plan and start
 * from the seed numbers.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The calculator could not render.', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="page" style={{ maxWidth: 640 }}>
        <h1 className="t-headline">Something in the saved plan could not be read.</h1>
        <p className="t-body mt-4">
          Your numbers are kept in this browser, and one of them is in a shape this build does not
          understand. Starting again from the default plan will clear it.
        </p>
        <p className="t-caption mt-3">{this.state.error.message}</p>
        <button
          type="button"
          className="text-button mt-6"
          onClick={() => {
            clearState()
            window.location.reload()
          }}
        >
          Clear the saved plan and start from the default numbers
        </button>
      </main>
    )
  }
}
