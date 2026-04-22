import { useCallback, useState } from 'react'
import { Card, Row, Col, Typography } from 'antd'
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

const { Paragraph, Title } = Typography

const CARD_TEXT: React.CSSProperties = { fontSize: 15, lineHeight: 1.7 }

export default function OverviewPage() {
  const fetchDashboard = useCallback(() => apiGet<DashboardPayload>('/dashboard'), [])
  const { data, state, loading, error, refetch } = useQuery(fetchDashboard, { cacheKey: 'dashboard' })
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
        <Card>
          <Typography.Text type="secondary">No data available yet. Start by ingesting data to see dashboard metrics.</Typography.Text>
        </Card>
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
        <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
          <Card>
            <Title level={4}>{data.scenario.scenario_name}</Title>
            <Paragraph style={CARD_TEXT}>{data.scenario.scenario_goal}</Paragraph>
            <Paragraph style={CARD_TEXT}>
              Run {data.scenario.run_id} processed {data.scenario.record_count} samples and selected {data.scenario.scenario_sample_count} scenario candidates.
            </Paragraph>
          </Card>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="Scenario Definition">
                <Paragraph style={CARD_TEXT}>Focus scenes: {data.scenario.focus_scenes.join(', ')}</Paragraph>
                <Paragraph style={CARD_TEXT}>Risk signals: {data.scenario.focus_tags.join(', ')}</Paragraph>
                <Paragraph style={CARD_TEXT}>Dominant scene: {data.scenario.dominant_scene}</Paragraph>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Priority Package">
                <Paragraph style={CARD_TEXT}>Priority samples: {data.scenario.priority_sample_ids.join(', ')}</Paragraph>
                <Paragraph style={CARD_TEXT}>Candidate samples: {data.scenario.candidate_sample_ids.join(', ')}</Paragraph>
                <Paragraph style={CARD_TEXT}>Search preview returns the same priority package for Web and SDK verification.</Paragraph>
              </Card>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="Loop Outputs">
                <Paragraph style={CARD_TEXT}>Summary artifact: {data.scenario.summary_output_uri}</Paragraph>
                <Paragraph style={CARD_TEXT}>Export artifact: {data.scenario.export_output_path}</Paragraph>
                <Paragraph style={CARD_TEXT}>Orchestrator asset: {data.scenario.orchestrator_asset_key}</Paragraph>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="What This Validates">
                <Paragraph style={CARD_TEXT}>Web triggers the bootstrap action, BFF aggregates scenario state, API serves stable resource semantics, and SDK reads the same scenario package.</Paragraph>
                <Paragraph style={CARD_TEXT}>DuckDB powers distribution, the platform currently materializes structured files in Parquet, retrieval already uses Lance, and the file-format evolution path is toward Lance as a more unified format family.</Paragraph>
              </Card>
            </Col>
          </Row>
        </div>
      ) : null}
      {data.streaming ? (
        <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
          <Card>
            <Title level={4}>Local-First Streaming Snapshot</Title>
            <Paragraph style={CARD_TEXT}>
              Streaming workspace {data.streaming.workspace_id} ingested {data.streaming.event_count} events across {data.streaming.batch_count} micro-batches and materialized {data.streaming.latest_sample_count} current samples.
            </Paragraph>
            <Paragraph style={CARD_TEXT}>
              Duplicate events skipped: {data.streaming.duplicate_events_skipped}. Export artifact: {data.streaming.export_path}.
            </Paragraph>
          </Card>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="Streaming Materialization">
                <Paragraph style={CARD_TEXT}>Event log: {data.streaming.event_log_path}</Paragraph>
                <Paragraph style={CARD_TEXT}>Bronze log: {data.streaming.bronze_log_path}</Paragraph>
                <Paragraph style={CARD_TEXT}>Silver snapshot: {data.streaming.silver_dataset_path}</Paragraph>
                <Paragraph style={CARD_TEXT}>Search index: {data.streaming.search_index_path}</Paragraph>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Streaming Signals">
                <Paragraph style={CARD_TEXT}>Top scenes: {data.streaming.distribution.map((row) => `${row.scene} (${row.sample_count})`).join(', ')}</Paragraph>
                <Paragraph style={CARD_TEXT}>Top tags: {data.streaming.tag_distribution.slice(0, 4).map((row) => `${row.tag} (${row.sample_count})`).join(', ')}</Paragraph>
                <Paragraph style={CARD_TEXT}>Latest run: {latestStreamingRun}</Paragraph>
              </Card>
            </Col>
          </Row>
        </div>
      ) : null}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <QuickActions
            onRunScenario={() => runScenario().then((message) => setSuccessMessage(message ?? null))}
            onRunStreaming={() => runStreaming().then((message) => setSuccessMessage(message ?? null))}
            runningScenario={runningDemo}
            runningStreaming={runningStreaming}
          />
        </Col>
        <Col xs={24} lg={12}>
          <RecentActivity
            tasks={data.tasks}
            exports={data.exports}
            runs={data.runs}
          />
        </Col>
      </Row>
    </PageContainer>
  )
}
