/**
 * Overview · Role-Based Dashboard
 *
 * 一屏给三类角色（Manager / Data Engineer / Machine Learning Engineer）的"今
 * 天最该看什么"。每张卡的数字默认可点 → 下钻到对应模块。
 *
 * 设计依据：docs/prd/module-overview.md。
 * 数据源：所有数据都通过现有 BFF 端点（apiGet → /api/...），不引入 dashboard
 * 物化端点（D1 in PRD）。
 *
 * 加载策略：每张卡独立 useQuery，单卡 loading skeleton；不阻塞其它卡。
 *
 * 视觉分段：4 个 SectionHeader 各有专属配色 + 图标（Overview · Manager · DE
 * · MLE），用户一眼能区分当前在看哪一段。
 */

import { useCallback, useMemo } from 'react'
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  ReloadOutlined,
  RocketOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { PageContainer } from '@/shared/components/page-container'
import { useQuery } from '@/shared/hooks/use-query'
import { IdCell } from '@/shared/components/id-cell'
import {
  fetchDatasets,
  fetchOpsOverview,
  fetchPipelineCostStats,
  fetchPipelineRuns,
  fetchRequirementStats,
  fetchScenarios,
  fetchSnapshotsSummary,
  fetchToolsRegistry,
  type DatasetSummary,
  type OpsModuleSummary,
  type PipelineRunRow,
  type RequirementStats,
  type ScenarioSummary,
  type ToolRegistryItem,
} from '../api'
import { OpsBacklogChart } from '../components/ops-backlog-chart'
import { CostTrendChart } from '../components/cost-trend-chart'
import { SectionHeader } from '../components/section-header'

const { Text } = Typography

// ───────────────────────────── helpers ─────────────────────────────

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

// ───────────────────────────── page ─────────────────────────────

export default function OverviewPage() {
  const navigate = useNavigate()

  // === independent queries (per-card error/loading isolation) ===
  const requirements = useQuery(useCallback(() => fetchRequirementStats(), []), { cacheKey: 'overview:req-stats' })
  const opsOverview = useQuery(useCallback(() => fetchOpsOverview(), []), { cacheKey: 'overview:ops' })
  const pipelineRuns = useQuery(useCallback(() => fetchPipelineRuns({ page_size: 200 }), []), { cacheKey: 'overview:runs' })
  const costStats = useQuery(useCallback(() => fetchPipelineCostStats(), []), { cacheKey: 'overview:cost-stats' })
  const officialDatasets = useQuery(useCallback(() => fetchDatasets({ dataset_type: 'official', limit: 50 }), []), { cacheKey: 'overview:datasets-official' })
  const allDatasets = useQuery(useCallback(() => fetchDatasets({ limit: 200 }), []), { cacheKey: 'overview:datasets-all' })
  const scenarios = useQuery(useCallback(() => fetchScenarios(), []), { cacheKey: 'overview:scenarios' })
  const tools = useQuery(useCallback(() => fetchToolsRegistry(), []), { cacheKey: 'overview:tools' })
  const snapshotsSummary = useQuery(useCallback(() => fetchSnapshotsSummary(), []), { cacheKey: 'overview:snapshots' })

  const reloadAll = () => {
    requirements.refetch()
    opsOverview.refetch()
    pipelineRuns.refetch()
    costStats.refetch()
    officialDatasets.refetch()
    allDatasets.refetch()
    scenarios.refetch()
    tools.refetch()
    snapshotsSummary.refetch()
  }

  // === Hero NSM ===
  const todayRunCount = useMemo(() => (
    (pipelineRuns.data?.items ?? []).filter((r) => isToday(r.created_at)).length
  ), [pipelineRuns.data])
  const totalCost = costStats.data?.totals.cost_usd ?? 0
  const opsBacklog = useMemo(() => (
    (opsOverview.data?.modules ?? []).reduce(
      (sum, m) => sum + Math.max(0, (m.counts.total ?? 0) - (m.counts.done ?? 0)),
      0,
    )
  ), [opsOverview.data])
  const datasetTotal = allDatasets.data?.total ?? 0

  return (
    <PageContainer
      title="Overview"
      description="Role-based dashboard：Manager 看交付，DE 看健康，MLE 看资产 —— 每个数字都可点下钻。"
      actions={
        <Button icon={<ReloadOutlined />} onClick={reloadAll}>Reload</Button>
      }
    >
      {/* ─── HERO NSM ─── */}
      <SectionHeader
        role="overview"
        icon={<DashboardOutlined />}
        title="平台北极星"
        subtitle="Overview · 4 项一级指标，反映平台总水位"
      />
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic
              title={<><DatabaseOutlined /> Total dataset assets</>}
              value={datasetTotal}
              suffix={
                snapshotsSummary.data
                  ? <Text type="secondary" style={{ fontSize: 12 }}> · {snapshotsSummary.data.used}/{snapshotsSummary.data.total} consumed</Text>
                  : undefined
              }
            />
            <Link to="/catalog?view=datasets">
              <Text type="secondary" style={{ fontSize: 12 }}>Open Catalog →</Text>
            </Link>
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title={<><RocketOutlined /> Today's pipeline runs</>}
              value={todayRunCount}
              suffix={pipelineRuns.data ? <Text type="secondary" style={{ fontSize: 12 }}> · last 200 sample</Text> : undefined}
            />
            <Link to="/pipelines?tab=runs">
              <Text type="secondary" style={{ fontSize: 12 }}>Open Pipelines →</Text>
            </Link>
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="Total cost (cumulative, USD)"
              value={totalCost}
              precision={4}
            />
            <Link to="/pipelines?tab=cost">
              <Text type="secondary" style={{ fontSize: 12 }}>Open Cost view →</Text>
            </Link>
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title={<><ExperimentOutlined /> Ops backlog (in flight)</>}
              value={opsBacklog}
              valueStyle={opsBacklog > 50 ? { color: '#d97706' } : undefined}
            />
            <Link to="/ops">
              <Text type="secondary" style={{ fontSize: 12 }}>Open Operations →</Text>
            </Link>
          </Col>
        </Row>
      </Card>

      {/* ─── Section A · Manager ─── */}
      <SectionHeader
        role="manager"
        icon={<LineChartOutlined />}
        title="数据闭环负责人"
        subtitle="Manager · 需求交付率 / 全链路折损 / 成本趋势"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <RequirementFunnelCard
            stats={requirements.data}
            error={requirements.error}
            loading={requirements.state === 'loading'}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <PipelineFunnelCard
            ops={opsOverview.data?.modules ?? []}
            scenarios={scenarios.data?.items ?? []}
            datasetCount={datasetTotal}
            officialCount={officialDatasets.data?.total ?? 0}
            loading={opsOverview.state === 'loading' || scenarios.state === 'loading'}
          />
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Cost Trend (last 14 days)"
            extra={<Link to="/pipelines?tab=cost">View detail →</Link>}
            loading={pipelineRuns.state === 'loading'}
            styles={{ body: { paddingTop: 8 } }}
          >
            <CostTrendChart runs={pipelineRuns.data?.items ?? []} windowDays={14} />
          </Card>
        </Col>
      </Row>

      {/* ─── Section B · Data Engineer ─── */}
      <SectionHeader
        role="de"
        icon={<ToolOutlined />}
        title="数据工程师"
        subtitle="Data Engineer · Pipeline 健康 / Ops 待办 / 工具状态"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <PipelineHealthCard
            runs={pipelineRuns.data?.items ?? []}
            loading={pipelineRuns.state === 'loading'}
            onClickFailed={() => navigate('/pipelines?tab=runs&status=failed')}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card
            title="Ops Backlog by module"
            extra={<Link to="/ops">All ops →</Link>}
            loading={opsOverview.state === 'loading'}
            styles={{ body: { paddingTop: 8 } }}
          >
            <OpsBacklogChart modules={opsOverview.data?.modules ?? []} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <ToolsHealthCard
            tools={tools.data?.items ?? []}
            loading={tools.state === 'loading'}
          />
        </Col>
      </Row>

      {/* ─── Section C · Machine Learning Engineer ─── */}
      <SectionHeader
        role="mle"
        icon={<ExperimentOutlined />}
        title="算法工程师"
        subtitle="Machine Learning Engineer · 最新数据资产 / 场景分布 / 快捷入口"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <LatestDatasetsCard
            datasets={officialDatasets.data?.items ?? []}
            loading={officialDatasets.state === 'loading'}
          />
        </Col>
        <Col xs={24} lg={10}>
          <ScenarioDistributionCard
            items={scenarios.data?.items ?? []}
            loading={scenarios.state === 'loading'}
          />
        </Col>
      </Row>
    </PageContainer>
  )
}

// ───────────────────────────── sub-components ─────────────────────────────

function RequirementFunnelCard({ stats, error, loading }: {
  stats: RequirementStats | null
  error: Error | null
  loading: boolean
}) {
  if (loading) return <Card title="Requirement funnel" loading />
  if (error) return <Card title="Requirement funnel"><Alert type="error" showIcon message={error.message} /></Card>
  const total = stats?.total ?? 0
  const byStatus = stats?.by_status ?? {}
  const byPriority = stats?.by_priority ?? {}
  return (
    <Card
      title="Requirement funnel"
      extra={<Link to="/requirements">All →</Link>}
      className="clickable-card"
      onClick={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('a, button')) return
        // whole-card click → /requirements
        window.location.href = '/requirements'
      }}
    >
      <Statistic title="Total requirements" value={total} valueStyle={{ fontSize: 24 }} />
      <Space wrap style={{ marginTop: 12 }}>
        {Object.entries(byStatus).map(([status, n]) => (
          <Tag key={status} color={status === 'completed' ? 'green' : status === 'in_progress' ? 'blue' : 'default'}>
            {status} · {n}
          </Tag>
        ))}
      </Space>
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>By priority: </Text>
        <Space size={4}>
          {Object.entries(byPriority).map(([prio, n]) => (
            <Tag key={prio} color={prio === 'high' ? 'red' : prio === 'medium' ? 'orange' : 'default'}>
              {prio}: {n}
            </Tag>
          ))}
        </Space>
      </div>
    </Card>
  )
}

function PipelineFunnelCard({ ops, scenarios, datasetCount, officialCount, loading }: {
  ops: OpsModuleSummary[]
  scenarios: ScenarioSummary[]
  datasetCount: number
  officialCount: number
  loading: boolean
}) {
  if (loading) return <Card title="Pipeline funnel" loading />
  const clipCount = scenarios.reduce((s, x) => s + x.clip_count, 0)
  const miningCounts = ops.find((m) => m.module === 'mining')?.counts ?? {}
  const labelingCounts = ops.find((m) => m.module === 'labeling')?.counts ?? {}
  const miningCandidates = (miningCounts.candidates_ready ?? 0) + (miningCounts.in_progress ?? 0)
  const labelingDone = labelingCounts.done ?? 0
  const stages = [
    { label: 'Collection clips', value: clipCount, to: '/explorer' },
    { label: 'Mining candidates', value: miningCandidates, to: '/ops/mining' },
    { label: 'Labeled', value: labelingDone, to: '/ops/labeling' },
    { label: `Datasets (${officialCount} official)`, value: datasetCount, to: '/catalog' },
  ]
  return (
    <Card title="Full-chain funnel" extra={<Link to="/pipelines?tab=runs">Runs →</Link>}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {stages.map((s, i) => (
          <Link key={s.label} to={s.to} style={{ display: 'block' }}>
            <div style={{
              padding: '8px 12px',
              background: 'var(--color-bg-secondary)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>
                <Text type="secondary" style={{ marginRight: 8 }}>{i + 1}.</Text>
                <Text>{s.label}</Text>
              </span>
              <Text strong style={{ fontSize: 18 }}>{s.value.toLocaleString()}</Text>
            </div>
          </Link>
        ))}
      </Space>
    </Card>
  )
}

function PipelineHealthCard({ runs, loading, onClickFailed }: {
  runs: PipelineRunRow[]
  loading: boolean
  onClickFailed: () => void
}) {
  if (loading) return <Card title="Pipeline health" loading />
  const counts = { running: 0, success: 0, failed: 0, pending: 0 }
  for (const r of runs) {
    if (r.status in counts) (counts as Record<string, number>)[r.status] += 1
  }
  const failedRuns = runs.filter((r) => r.status === 'failed').slice(0, 3)
  return (
    <Card title="Pipeline health (last 200)" extra={<Link to="/pipelines?tab=runs">All runs →</Link>}>
      <Row gutter={8}>
        <Col span={8}>
          <Statistic
            title={<span><ClockCircleOutlined /> Running</span>}
            value={counts.running}
            valueStyle={{ fontSize: 22, color: '#2563eb' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<span><CheckCircleOutlined /> Success</span>}
            value={counts.success}
            valueStyle={{ fontSize: 22, color: '#16a34a' }}
          />
        </Col>
        <Col span={8} style={{ cursor: 'pointer' }} onClick={onClickFailed}>
          <Statistic
            title={<span><CloseCircleOutlined /> Failed</span>}
            value={counts.failed}
            valueStyle={{ fontSize: 22, color: '#dc2626' }}
            suffix={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          />
        </Col>
      </Row>
      {failedRuns.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Failed top 3</Text>
          <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 4 }}>
            {failedRuns.map((r) => (
              <div key={r.id} style={{ fontSize: 12 }}>
                <Tag color="red">{r.stage}</Tag>
                <Text>{r.pipeline_name}</Text>{' '}
                <Text type="secondary">· {formatTs(r.completed_at ?? r.created_at)}</Text>
              </div>
            ))}
          </Space>
        </div>
      )}
    </Card>
  )
}

function ToolsHealthCard({ tools, loading }: { tools: ToolRegistryItem[]; loading: boolean }) {
  if (loading) return <Card title="Tools" loading />
  if (tools.length === 0) {
    return (
      <Card title="Tools" extra={<Link to="/tools">All tools →</Link>}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tools registered" />
      </Card>
    )
  }
  return (
    <Card title="Tools" extra={<Link to="/tools">All tools →</Link>}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {tools.slice(0, 6).map((t) => (
          <Link
            key={t.id}
            to={t.workspace_path ?? `/tools/${t.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: 4,
              background: 'var(--color-bg-secondary)',
            }}
          >
            <span>
              <Text strong>{t.short_name ?? t.name}</Text>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>· {t.category}</Text>
            </span>
            <ArrowRightOutlined style={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
          </Link>
        ))}
      </Space>
    </Card>
  )
}

function LatestDatasetsCard({ datasets, loading }: { datasets: DatasetSummary[]; loading: boolean }) {
  if (loading) return <Card title="Latest official datasets" loading />
  // sort by updated_at desc
  const sorted = [...datasets].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5)
  return (
    <Card
      title="Latest Official Datasets"
      extra={<Link to="/catalog?view=datasets">All datasets →</Link>}
    >
      {sorted.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No official dataset yet. Promote a customized one in /ops/release." />
      ) : (
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          {sorted.map((d) => (
            <Link key={d.id} to={`/catalog/v2/${encodeURIComponent(d.id)}`} style={{ display: 'block' }}>
              <Space size={12} style={{ width: '100%' }}>
                <Tag color={d.allow_train ? 'green' : 'default'}>
                  v{d.dataset_version}
                </Tag>
                <Text strong>{d.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{formatTs(d.updated_at)}</Text>
              </Space>
              <div style={{ marginLeft: 4 }}>
                <IdCell value={d.id} />
              </div>
            </Link>
          ))}
        </Space>
      )}
    </Card>
  )
}

function ScenarioDistributionCard({ items, loading }: { items: ScenarioSummary[]; loading: boolean }) {
  if (loading) return <Card title="Top scenarios" loading />
  const top = [...items].sort((a, b) => b.clip_count - a.clip_count).slice(0, 5)
  const max = top[0]?.clip_count ?? 1
  return (
    <Card
      title="Top scenarios"
      extra={<Link to="/explorer/search">Open Explorer →</Link>}
    >
      {top.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No scenarios indexed." />
      ) : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {top.map((s) => {
            const pct = (s.clip_count / max) * 100
            return (
              <Link
                key={s.scenario_id}
                to={`/explorer/search?scenario=${encodeURIComponent(s.scenario_name)}`}
                style={{ display: 'block' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text strong style={{ fontSize: 13 }}>{s.scenario_name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {s.clip_count} clips · {Math.round(s.duration_seconds / 60)} min
                  </Text>
                </div>
                <div style={{
                  height: 6,
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: 'var(--color-accent)',
                    transition: 'width 200ms',
                  }} />
                </div>
              </Link>
            )
          })}
        </Space>
      )}
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
        <Space wrap size={8}>
          <Link to="/explorer/search"><Tag color="blue">Search clips</Tag></Link>
          <Link to="/exports?tab=hard-samples"><Tag color="orange">Hard samples</Tag></Link>
          <Link to="/catalog?view=datasets"><Tag color="green">Browse datasets</Tag></Link>
        </Space>
      </div>
    </Card>
  )
}
