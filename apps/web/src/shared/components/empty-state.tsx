interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No data available' }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  )
}
