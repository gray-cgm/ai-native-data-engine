const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--color-warning)',
  running: 'var(--color-info)',
  done: 'var(--color-success)',
  completed: 'var(--color-success)',
  failed: 'var(--color-danger)',
  canceled: 'var(--color-muted)',
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? 'var(--color-muted)'
  return (
    <span
      className="status-badge"
      style={{ borderColor: color, color }}
    >
      {status}
    </span>
  )
}
