import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="bg-danger-bg border border-danger/20 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-base font-semibold text-danger mb-2">Something went wrong</h2>
            <pre className="text-xs text-danger/80 whitespace-pre-wrap break-all bg-white/50 rounded p-3 mt-2">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 text-sm text-danger underline"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
