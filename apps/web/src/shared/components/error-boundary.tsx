import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <h3>Something went wrong</h3>
            <p className="text-muted">{this.state.error.message}</p>
            <button onClick={() => this.setState({ error: null })}>Retry</button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
