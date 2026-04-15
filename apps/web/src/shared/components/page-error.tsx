interface PageErrorProps {
  message?: string
  onRetry?: () => void
}

export function PageError({ message, onRetry }: PageErrorProps) {
  return (
    <div className="page-error" style={{ textAlign: 'center', padding: '48px' }}>
      <h3>Unable to load content</h3>
      <p className="text-muted">{message || 'An error occurred while loading data.'}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: 'var(--space-md)' }}>
          Try Again
        </button>
      )}
    </div>
  )
}
