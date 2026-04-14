import { StatCard } from '@/shared/components/stat-card'

interface PlatformStatsProps {
  datasetCount: number
  taskCount: number
  sampleCount: number
  exportCount: number
  scenarioSampleCount: number
  prioritySampleCount: number
}

export function PlatformStats({ datasetCount, taskCount, sampleCount, exportCount, scenarioSampleCount, prioritySampleCount }: PlatformStatsProps) {
  return (
    <div className="grid-four" style={{ marginBottom: 'var(--space-2xl)' }}>
      <StatCard label="Datasets" value={datasetCount} />
      <StatCard label="Tasks" value={taskCount} />
      <StatCard label="Samples" value={sampleCount} />
      <StatCard label="Exports" value={exportCount} />
      <StatCard label="Scenario Samples" value={scenarioSampleCount} />
      <StatCard label="Priority Samples" value={prioritySampleCount} />
    </div>
  )
}
