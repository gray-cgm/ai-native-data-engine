import { useCallback } from 'react'
import { apiGet } from '@/shared/api/client'
import { useQuery } from '@/shared/hooks/use-query'
import type { DashboardPayload } from '@/shared/types/common'
import { PageContainer } from '@/shared/components/page-container'
import { PlatformStats } from '../components/platform-stats'
import { QuickActions } from '../components/quick-actions'
import { RecentActivity } from '../components/recent-activity'

export default function OverviewPage() {
  const fetchDashboard = useCallback(() => apiGet<DashboardPayload>('/dashboard'), [])
  const { data, loading } = useQuery(fetchDashboard)

  if (loading || !data) {
    return <div className="page-loading">Loading...</div>
  }

  const totalSamples = data.distribution.reduce((sum, row) => sum + row.sample_count, 0)

  return (
    <PageContainer
      title="Overview"
      description="AI Data Closed-Loop Workbench — unified data asset management, exploration, and export."
    >
      <PlatformStats
        datasetCount={data.datasets.length}
        taskCount={data.tasks.length}
        sampleCount={totalSamples}
        exportCount={data.exports.length}
      />
      <div className="grid-two">
        <QuickActions />
        <RecentActivity
          tasks={data.tasks}
          exports={data.exports}
        />
      </div>
    </PageContainer>
  )
}
