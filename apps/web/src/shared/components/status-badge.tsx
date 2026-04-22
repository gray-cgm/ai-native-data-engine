import { Tag } from 'antd'

const STATUS_COLORS: Record<string, string> = {
  pending: 'warning',
  pending_review: 'warning',
  running: 'processing',
  in_progress: 'processing',
  done: 'success',
  completed: 'success',
  approved: 'success',
  failed: 'error',
  rejected: 'error',
  blocked: 'error',
  canceled: 'default',
  cancelled: 'default',
  draft: 'default',
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? 'default'
  return <Tag color={color}>{status.replace(/_/g, ' ')}</Tag>
}
