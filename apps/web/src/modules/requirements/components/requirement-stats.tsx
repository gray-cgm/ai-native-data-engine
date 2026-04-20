import { StatCard } from '@/shared/components/stat-card'
import type { RequirementStats } from '../api'

interface RequirementStatsBarProps {
  stats: RequirementStats
}

export function RequirementStatsBar({ stats }: RequirementStatsBarProps) {
  return (
    <div className="grid-four" style={{ marginBottom: 'var(--space-2xl)' }}>
      <StatCard label="Total" value={stats.total} />
      <StatCard label="Draft" value={stats.by_status?.draft ?? 0} />
      <StatCard label="In Progress" value={stats.by_status?.in_progress ?? 0} />
      <StatCard label="Completed" value={stats.by_status?.completed ?? 0} />
      <StatCard label="High Priority" value={stats.by_priority?.high ?? 0} />
      <StatCard label="Medium Priority" value={stats.by_priority?.medium ?? 0} />
      <StatCard label="Low Priority" value={stats.by_priority?.low ?? 0} />
      <StatCard label="Cancelled" value={stats.by_status?.cancelled ?? 0} />
    </div>
  )
}
