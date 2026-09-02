import { Component } from 'react'

function isChunkError(error) {
  const msg = error?.message ?? ''
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Unable to preload CSS') ||
    error?.name === 'ChunkLoadError'
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, chunkError: false }
  }

  static getDerivedStateFromError(error) {
    return { error, chunkError: isChunkError(error) }
  }

  componentDidCatch(error, info) {
    if (isChunkError(error)) {
      // Stale deployment — old chunk hashes. Reload silently to get fresh assets.
      window.location.reload()
      return
    }
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (this.state.chunkError) {
      // Page is about to reload — show nothing to avoid a flash
      return null
    }
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="bg-danger-bg border border-danger/20 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-base font-semibold text-danger mb-2">Something went wrong</h2>
            <p className="text-sm text-danger/80">
              This screen ran into a problem. Reloading usually fixes it — if it keeps happening, let your administrator know.
            </p>
            {import.meta.env.DEV && (
              <pre className="text-xs text-danger/80 whitespace-pre-wrap break-all bg-surface-alt rounded p-3 mt-3">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-danger underline"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
