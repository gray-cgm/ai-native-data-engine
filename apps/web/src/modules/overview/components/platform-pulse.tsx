import { StatCard } from '@/shared/components/stat-card'

interface Props {
  clipCount: number
  scenarioCount: number
  datasetCount: number
  activeWork: number
  releasedCount: number
  pendingReleaseCount: number
  exportCount: number
  durationHours: number
}

export function PlatformPulse({
  clipCount,
  scenarioCount,
  datasetCount,
  activeWork,
  releasedCount,
  pendingReleaseCount,
  exportCount,
  durationHours,
}: Props) {
  return (
    <div className="grid-four" style={{ marginBottom: 'var(--space-2xl)' }}>
      <StatCard label="Clips" value={clipCount} />
      <StatCard label="Scenarios" value={scenarioCount} />
      <StatCard label="Datasets" value={datasetCount} />
      <StatCard label="Duration (h)" value={Number(durationHours.toFixed(1))} />
      <StatCard label="Active Work" value={activeWork} />
      <StatCard label="Released" value={releasedCount} />
      <StatCard label="Pending Release" value={pendingReleaseCount} />
      <StatCard label="Exports" value={exportCount} />
    </div>
  )
}
