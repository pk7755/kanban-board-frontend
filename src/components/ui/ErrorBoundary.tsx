/**
 * ErrorBoundary.tsx
 * Class-based error boundary — catches render errors and shows a friendly
 * fallback with a "Try again" button. Spec: "Error Boundary that catches
 * render errors and shows a friendly message".
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom fallback element */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Production apps would send to an error monitoring service (e.g. Sentry).
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 'var(--space-4)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ fontSize: '2.5rem' }} aria-hidden="true">😵</span>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '40ch', margin: 0 }}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-default)',
              color: 'var(--accent-foreground)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
