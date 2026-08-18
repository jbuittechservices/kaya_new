import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 px-6 text-center">
          <h1 className="text-xl font-extrabold text-navy-950">Something went wrong</h1>
          <p className="max-w-sm text-sm text-slate-muted">
            An unexpected error occurred. Try reloading the page — if it keeps happening, please let us know.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false })
              window.location.href = '/'
            }}
            className="tap rounded-2xl bg-navy-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
