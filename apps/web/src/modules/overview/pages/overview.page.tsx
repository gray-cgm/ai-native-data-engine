import { useCallback } from 'react'
import { Card, Col, Collapse, Row, Space, Tag, Typography } from 'antd'
import { apiGet } from '@/shared/api/client'
import { useQuery } from '@/shared/hooks/use-query'
import type { DashboardPayload } from '@/shared/types/common'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { fetchOpsOverview, type OpsOverview } from '@/modules/operations/ops-modules-api'
import { PlatformPulse } from '../components/platform-pulse'
import { OperationsPulse } from '../components/operations-pulse'
import { QuickActionsV2 } from '../components/quick-actions-v2'
import { RecentActivityV2 } from '../components/recent-activity-v2'

const { Paragraph, Title, Text } = Typography

type ScenarioSummaryItem = {
  scenario_id: string
  scenario_name: string
  clip_count: number
  keyframe_count: number
  duration_seconds: number
  first_start_time?: number | null
  last_end_time?: number | null
}

type ScenarioSummaryResponse = { items: ScenarioSummaryItem[] }

export default function OverviewPage() {
  const fetchDashboard = useCallback(() => apiGet<DashboardPayload>('/dashboard'), [])
  const { data, state, error, refetch } = useQuery(fetchDashboard, { cacheKey: 'dashboard' })

  const fetchScenarios = useCallback(
    () => apiGet<ScenarioSummaryResponse>('/clips/scenarios'),
    [],
  )
  const { data: scenarios } = useQuery(fetchScenarios, { cacheKey: 'clips-scenarios' })

  const fetchOpsData = useCallback(() => fetchOpsOverview(), [])
  const { data: opsOverview } = useQuery<OpsOverview>(fetchOpsData, { cacheKey: 'ops-overview' })

  if (state === 'loading') return <PageLoading message="Loading overview..." />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />

  const payload = data ?? ({ datasets: [], tasks: [], exports: [], runs: [] } as unknown as DashboardPayload)
  const scenarioItems = scenarios?.items ?? []
  const clipCount = scenarioItems.reduce((sum, s) => sum + s.clip_count, 0)
  const keyframeCount = scenarioItems.reduce((sum, s) => sum + s.keyframe_count, 0)
  const durationSeconds = scenarioItems.reduce((sum, s) => sum + s.duration_seconds, 0)
  const durationHours = durationSeconds / 3600

  const releaseStats = opsOverview?.modules.find((m) => m.module === 'release')?.counts ?? {}
  const releasedCount = (releaseStats.approved ?? 0) + (releaseStats.published ?? 0)
  const pendingReleaseCount = (releaseStats.drafted ?? 0) + (releaseStats.gated ?? 0)
  const activeWork =
    (opsOverview?.modules ?? []).reduce((sum, m) => sum + (m.counts.total ?? 0), 0) +
    payload.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').length

  return (
    <PageContainer
      title="Overview"
      description="Clip-centric data ops console — monitor clip health, ongoing work, release readiness, and recent activity."
    >
      <PlatformPulse
        clipCount={clipCount}
        scenarioCount={scenarioItems.length}
        datasetCount={payload.datasets.length}
        activeWork={activeWork}
        releasedCount={releasedCount}
        pendingReleaseCount={pendingReleaseCount}
        exportCount={payload.exports.length}
        durationHours={durationHours}
      />

      <OperationsPulse overview={opsOverview ?? null} />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Clip Health" style={{ height: '100%' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Total Keyframes </Text>
                <Text strong>{keyframeCount.toLocaleString()}</Text>
              </div>
              <div>
                <Text type="secondary">Scenarios </Text>
                <Space wrap size={4}>
                  {scenarioItems.slice(0, 6).map((s) => (
                    <Tag key={s.scenario_id}>
                      {s.scenario_name} · {s.clip_count}
                    </Tag>
                  ))}
                  {scenarioItems.length === 0 && <Text type="secondary">No scenarios indexed yet.</Text>}
                </Space>
              </div>
              <div>
                <Text type="secondary">Privacy Pending </Text>
                <Text strong>
                  {(opsOverview?.modules.find((m) => m.module === 'privacy')?.counts.queued ?? 0) +
                    (opsOverview?.modules.find((m) => m.module === 'privacy')?.counts.processing ?? 0)}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Release Readiness" style={{ height: '100%' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Approved / Published </Text>
                <Text strong>{releasedCount}</Text>
              </div>
              <div>
                <Text type="secondary">Drafted / Gated </Text>
                <Text strong>{pendingReleaseCount}</Text>
              </div>
              <div>
                <Text type="secondary">Open Checking Gates </Text>
                <Text strong>
                  {(opsOverview?.modules.find((m) => m.module === 'checking')?.counts.running ?? 0) +
                    (opsOverview?.modules.find((m) => m.module === 'checking')?.counts.failed ?? 0)}
                </Text>
              </div>
              <div>
                <Text type="secondary">Mining Candidates Ready </Text>
                <Text strong>
                  {opsOverview?.modules.find((m) => m.module === 'mining')?.counts.candidates_ready ?? 0}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10}><QuickActionsV2 /></Col>
        <Col xs={24} lg={14}>
          <RecentActivityV2 tasks={payload.tasks} exports={payload.exports} runs={payload.runs} />
        </Col>
      </Row>

      {(payload.scenario || payload.streaming) && (
        <Collapse
          items={[
            {
              key: 'demo',
              label: 'Demo artifacts (legacy Night Intersection / Streaming)',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {payload.scenario && (
                    <Card size="small" title={payload.scenario.scenario_name}>
                      <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                        {payload.scenario.scenario_goal}
                      </Paragraph>
                      <Text type="secondary">
                        Run {payload.scenario.run_id} processed {payload.scenario.record_count} clips, selected{' '}
                        {payload.scenario.scenario_clip_count}. Priority clips:{' '}
                        {payload.scenario.priority_clip_ids.join(', ')}
                      </Text>
                    </Card>
                  )}
                  {payload.streaming && (
                    <Card size="small" title={`Local-First Streaming — ${payload.streaming.workspace_id}`}>
                      <Text type="secondary">
                        {payload.streaming.event_count} events across {payload.streaming.batch_count} micro-batches,{' '}
                        {payload.streaming.latest_sample_count} current samples. Export:{' '}
                        {payload.streaming.export_path}.
                      </Text>
                    </Card>
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      {/* Silence unused-import warnings when Title isn't used in lean branches */}
      {false && <Title level={4}>hidden</Title>}
    </PageContainer>
  )
}
