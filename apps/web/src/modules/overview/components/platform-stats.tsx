import { StatCard } from '@/shared/components/stat-card'

interface PlatformStatsProps {
  datasetCount: number
  taskCount: number
  sampleCount: number
  exportCount: number
}

export function PlatformStats({ datasetCount, taskCount, sampleCount, exportCount }: PlatformStatsProps) {
  return (
    <div className="grid-four" style={{ marginBottom: 'var(--space-2xl)' }}>
      <StatCard label="Datasets" value={datasetCount} />
      <StatCard label="Tasks" value={taskCount} />
      <StatCard label="Samples" value={sampleCount} />
      <StatCard label="Exports" value={exportCount} />
    </div>
  )
}
