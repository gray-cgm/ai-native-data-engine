import { useCallback } from 'react'
import { apiGet, apiPost } from '@/shared/api/client'
import { useMutation } from '@/shared/hooks/use-mutation'
import { useQuery } from '@/shared/hooks/use-query'
import type { DashboardPayload } from '@/shared/types/common'
import { PageContainer } from '@/shared/components/page-container'
import { PlatformStats } from '../components/platform-stats'
import { QuickActions } from '../components/quick-actions'
import { RecentActivity } from '../components/recent-activity'

export default function OverviewPage() {
  const fetchDashboard = useCallback(() => apiGet<DashboardPayload>('/dashboard'), [])
  const { data, loading, refetch } = useQuery(fetchDashboard)
  const { loading: runningDemo, mutate } = useMutation(async () => {
    await apiPost('/bootstrap')
    await refetch()
    return null
  })

  if (loading || !data) {
    return <div className="page-loading">Loading...</div>
  }

  const totalSamples = data.distribution.reduce((sum, row) => sum + row.sample_count, 0)
  const scenarioSampleCount = data.scenario?.scenario_sample_count ?? 0
  const prioritySampleCount = data.scenario?.priority_sample_ids.length ?? 0

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
        scenarioSampleCount={scenarioSampleCount}
        prioritySampleCount={prioritySampleCount}
      />
      {data.scenario ? (
        <div style={{ display: 'grid', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <div className="card">
            <h3>{data.scenario.scenario_name}</h3>
            <p>{data.scenario.scenario_goal}</p>
            <p>
              Run {data.scenario.run_id} processed {data.scenario.record_count} samples and selected {data.scenario.scenario_sample_count} scenario candidates.
            </p>
          </div>
          <div className="grid-two">
            <div className="card">
              <h3>Scenario Definition</h3>
              <p>Focus scenes: {data.scenario.focus_scenes.join(', ')}</p>
              <p>Risk signals: {data.scenario.focus_tags.join(', ')}</p>
              <p>Dominant scene: {data.scenario.dominant_scene}</p>
            </div>
            <div className="card">
              <h3>Priority Package</h3>
              <p>Priority samples: {data.scenario.priority_sample_ids.join(', ')}</p>
              <p>Candidate samples: {data.scenario.candidate_sample_ids.join(', ')}</p>
              <p>Search preview returns the same priority package for Web and SDK verification.</p>
            </div>
          </div>
          <div className="grid-two">
            <div className="card">
              <h3>Loop Outputs</h3>
              <p>Summary artifact: {data.scenario.summary_output_uri}</p>
              <p>Export artifact: {data.scenario.export_output_path}</p>
              <p>Orchestrator asset: {data.scenario.orchestrator_asset_key}</p>
            </div>
            <div className="card">
              <h3>What This Validates</h3>
              <p>Web triggers the bootstrap action, BFF aggregates scenario state, API serves stable resource semantics, and SDK reads the same scenario package.</p>
              <p>DuckDB powers distribution, Lance powers preview retrieval, Parquet stores the exported table, and SQLite tracks runs, tasks, exports, and lineage.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid-two">
        <QuickActions onRunScenario={() => mutate()} runningScenario={runningDemo} />
        <RecentActivity
          tasks={data.tasks}
          exports={data.exports}
          runs={data.runs}
        />
      </div>
    </PageContainer>
  )
}
