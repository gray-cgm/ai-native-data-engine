import { useCallback, useState } from 'react'
import { apiGet } from '@/shared/api/client'
import { useQuery } from '@/shared/hooks/use-query'
import type { DashboardPayload } from '@/shared/types/common'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { PageSuccess } from '@/shared/components/page-success'
import { PlatformStats } from '../components/platform-stats'
import { QuickActions } from '../components/quick-actions'
import { RecentActivity } from '../components/recent-activity'

export default function OverviewPage() {
  const fetchDashboard = useCallback(() => apiGet<DashboardPayload>('/dashboard'), [])
  const { data, state, error, refetch } = useQuery(fetchDashboard)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (state === 'loading') {
    return <PageLoading message="Loading dashboard..." />
  }

  if (state === 'error') {
    return <PageError message={error?.message} onRetry={refetch} />
  }

  if (state === 'empty' || !data) {
    return (
      <PageContainer title="Overview">
        <div className="card">
          <p className="text-muted">No data available yet. Start by ingesting data to see dashboard metrics.</p>
        </div>
      </PageContainer>
    )
  }

  const totalSamples = data.distribution.reduce((sum, row) => sum + row.sample_count, 0)

  return (
    <PageContainer
      title="Overview"
      description="AI Data Closed-Loop Workbench — unified data asset management, exploration, and export."
    >
      {successMessage && (
        <PageSuccess
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          autoCloseDuration={3000}
        />
      )}
      <PlatformStats
        datasetCount={data.datasets.length}
        taskCount={data.tasks.length}
        sampleCount={totalSamples}
        exportCount={data.exports.length}
      />
      <div className="grid-two">
        <QuickActions />
        <RecentActivity tasks={data.tasks} exports={data.exports} />
      </div>
    </PageContainer>
  )
}

