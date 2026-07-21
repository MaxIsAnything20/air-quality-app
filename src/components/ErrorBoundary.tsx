import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level render-error safety net. This does NOT replace the app's
 * existing per-feature fallback pattern (sample data + banner on fetch
 * failure) — those stay exactly as they are and keep handling network/API
 * errors gracefully. This only catches unexpected *render* crashes (a bad
 * prop shape, a null-reference in a component, etc.) that would otherwise
 * unmount the whole app to a blank white screen with no explanation.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Vercel captures console.error output in each function/build's logs;
    // in the browser this also shows in devtools console for local debugging.
    console.error('AirTrack crashed:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-200 dark:bg-night-900 p-6 transition-colors">
        <div className="w-full sm:max-w-[390px] rounded-2xl border border-ink-400 dark:border-night-500 bg-white dark:bg-night-800 p-6 text-center">
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 mb-2">
            Something went wrong.
          </p>
          <p className="text-xs text-ink-600 dark:text-night-300 mb-4">
            AirTrack hit an unexpected error and couldn't continue. Reloading
            usually fixes it — your saved profile and history aren't affected.
          </p>
          <button
            onClick={this.handleReload}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-ink-900 dark:bg-night-100 text-white dark:text-night-900"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
