import { useCallback, useState } from 'react'
import { apiGet, apiPost } from '@/shared/api/client'
import { useMutation } from '@/shared/hooks/use-mutation'
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
  const { data, state, loading, error, refetch } = useQuery(fetchDashboard)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { loading: runningDemo, mutate: runScenario } = useMutation(async () => {
    await apiPost('/bootstrap')
    await refetch()
    return 'Night Intersection Triage finished.'
  })
  const { loading: runningStreaming, mutate: runStreaming } = useMutation(async () => {
    await apiPost('/streaming/bootstrap')
    await refetch()
    return 'Local streaming demo finished.'
  })

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

  const totalSamples = data.distribution?.reduce((sum, row) => sum + row.sample_count, 0) || 0
  const scenarioSampleCount = data.scenario?.scenario_sample_count ?? 0
  const prioritySampleCount = data.scenario?.priority_sample_ids.length ?? 0
  const streamingEventCount = data.streaming?.event_count ?? 0
  const streamingSampleCount = data.streaming?.latest_sample_count ?? 0
  const latestStreamingRun = data.streaming?.batch_summaries[data.streaming.batch_summaries.length - 1]?.run_id ?? 'n/a'

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
        scenarioSampleCount={scenarioSampleCount}
        prioritySampleCount={prioritySampleCount}
        streamingEventCount={streamingEventCount}
        streamingSampleCount={streamingSampleCount}
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
              <p>DuckDB powers distribution, the platform currently materializes structured files in Parquet, retrieval already uses Lance, and the file-format evolution path is toward Lance as a more unified format family.</p>
            </div>
          </div>
        </div>
      ) : null}
      {data.streaming ? (
        <div style={{ display: 'grid', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <div className="card">
            <h3>Local-First Streaming Snapshot</h3>
            <p>
              Streaming workspace {data.streaming.workspace_id} ingested {data.streaming.event_count} events across {data.streaming.batch_count} micro-batches and materialized {data.streaming.latest_sample_count} current samples.
            </p>
            <p>
              Duplicate events skipped: {data.streaming.duplicate_events_skipped}. Export artifact: {data.streaming.export_path}.
            </p>
          </div>
          <div className="grid-two">
            <div className="card">
              <h3>Streaming Materialization</h3>
              <p>Event log: {data.streaming.event_log_path}</p>
              <p>Bronze log: {data.streaming.bronze_log_path}</p>
              <p>Silver snapshot: {data.streaming.silver_dataset_path}</p>
              <p>Search index: {data.streaming.search_index_path}</p>
            </div>
            <div className="card">
              <h3>Streaming Signals</h3>
              <p>Top scenes: {data.streaming.distribution.map((row) => `${row.scene} (${row.sample_count})`).join(', ')}</p>
              <p>Top tags: {data.streaming.tag_distribution.slice(0, 4).map((row) => `${row.tag} (${row.sample_count})`).join(', ')}</p>
              <p>Latest run: {latestStreamingRun}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid-two">
        <QuickActions
          onRunScenario={() => runScenario().then((message) => setSuccessMessage(message ?? null))}
          onRunStreaming={() => runStreaming().then((message) => setSuccessMessage(message ?? null))}
          runningScenario={runningDemo}
          runningStreaming={runningStreaming}
        />
        <RecentActivity
          tasks={data.tasks}
          exports={data.exports}
          runs={data.runs}
        />
      </div>
    </PageContainer>
  )
}

