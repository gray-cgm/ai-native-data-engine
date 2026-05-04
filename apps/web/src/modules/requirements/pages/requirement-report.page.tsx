/**
 * Requirement Report —— Role-Based 报表（对齐 Overview Dashboard 设计）
 *
 * 单需求维度的"小型 Overview"：3 段配色 SectionHeader（Manager / DE / MLE），
 * 每段卡都可下钻。1:N 关系在 MLE 段显式展开（一个需求 → N 个 dataset）。
 *
 * 设计依据：docs/prd/module-requirement.md §3.3。
 */

import { useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, Descriptions, Empty, Row, Space, Statistic, Table, Tag, Typography,
} from 'antd'
import {
  ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  ExperimentOutlined, LineChartOutlined, ToolOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { PageError } from '@/shared/components/page-error'
import { IdCell } from '@/shared/components/id-cell'
import { StatusBadge } from '@/shared/components/status-badge'
import { TableCellText } from '@/shared/components/table-cell-text'
import { SectionHeader } from '@/modules/overview/components/section-header'
import {
  fetchRequirementReport,
  type DatasetSummaryItem,
  type FunnelStage,
  type RequirementReportView,
} from '../api'

const { Text, Paragraph } = Typography

const TASK_TYPE_LABEL: Record<string, string> = {
  collection: '采集',
  mining: '挖掘',
  tagging: '场景打标',
  labeling: '对象标注',
  checking: '质量校验',
  release: '发版交付',
}

function FunnelBar({ stage }: { stage: FunnelStage }) {
  const ratio = Math.max(0, Math.min(1, stage.completion_ratio))
  const pct = Math.round(ratio * 100)
  const color = ratio >= 0.9 ? '#16a34a' : ratio >= 0.5 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text>
          {TASK_TYPE_LABEL[stage.task_type] ?? stage.task_type}
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            ({stage.completed_task_count}/{stage.task_count} tasks)
          </Text>
        </Text>
        <Text>
          <Text strong>{stage.actual_count.toLocaleString()}</Text>
          <Text type="secondary"> / {stage.target_count.toLocaleString()}</Text>
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>{pct}%</Text>
        </Text>
      </div>
      <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 200ms' }} />
      </div>
    </div>
  )
}

export default function RequirementReportPage() {
  const { id } = useParams<{ id: string }>()
  const fetcher = useCallback(() => fetchRequirementReport(id!), [id])
  const { data, state, error, refetch } = useQuery<RequirementReportView>(fetcher, {
    cacheKey: `requirement-report:${id}`,
  })

  if (state === 'loading') return <PageLoading message="Building requirement report..." />
  if (state === 'error') return <PageError message={error?.message} onRetry={refetch} />
  if (!data) {
    return (
      <PageContainer title="Requirement Report">
        <Card><Text type="secondary">No report data available.</Text></Card>
      </PageContainer>
    )
  }

  const { requirement, headline, sections } = data
  const { manager, data_engineer: de, mle } = sections

  return (
    <PageContainer
      title="Requirement Report"
      description={`${requirement.title} · ${requirement.id}`}
      actions={
        <Space>
          <Link to={`/requirements/${requirement.id}`}><Button>Back to Requirement</Button></Link>
          <Button onClick={refetch}>Reload</Button>
        </Space>
      }
    >
      {/* ─── Headline KPI ─── */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={16}>
          <Col xs={12} md={4}><Statistic title="DataTasks" value={`${headline.data_task_completed}/${headline.data_task_count}`} /></Col>
          <Col xs={12} md={4}><Statistic title="OpsTasks" value={headline.ops_task_count} /></Col>
          <Col xs={12} md={4}><Statistic title="PipelineRuns" value={headline.pipeline_run_count} /></Col>
          <Col xs={12} md={4}><Statistic title="Datasets" value={headline.dataset_count} valueStyle={{ color: 'var(--color-accent)' }} /></Col>
          <Col xs={12} md={4}><Statistic title="Snapshots" value={headline.snapshot_count} /></Col>
          <Col xs={12} md={4}><Statistic title="LineageEvents" value={headline.lineage_event_count} /></Col>
        </Row>
      </Card>

      {/* ─── Section A · Manager ─── */}
      <SectionHeader
        role="manager"
        icon={<LineChartOutlined />}
        title="数据闭环负责人"
        subtitle="Manager · 6 类 DataTask 进度漏斗 / Pipeline 总成本"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Full-chain Funnel" extra={<Link to={`/requirements/${requirement.id}`}>需求详情 →</Link>}>
            {manager.funnel.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data tasks linked." />
            ) : (
              manager.funnel.map((s) => <FunnelBar key={s.task_type} stage={s} />)
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Cost Summary" extra={<Link to={`/pipelines?tab=cost&requirement_id=${requirement.id}`}>Cost view →</Link>}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Total cost (USD)">${manager.cost.total_cost_usd.toFixed(4)}</Descriptions.Item>
              <Descriptions.Item label="CPU seconds">{Math.round(manager.cost.total_cpu_seconds)}s</Descriptions.Item>
              <Descriptions.Item label="GPU seconds">{Math.round(manager.cost.total_gpu_seconds)}s</Descriptions.Item>
              <Descriptions.Item label="Total duration">{Math.round(manager.cost.total_duration_seconds)}s</Descriptions.Item>
              <Descriptions.Item label="Rows processed">
                in {manager.cost.total_rows_in.toLocaleString()} → out {manager.cost.total_rows_out.toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* ─── Section B · Data Engineer ─── */}
      <SectionHeader
        role="de"
        icon={<ToolOutlined />}
        title="数据工程师"
        subtitle="Data Engineer · Pipeline 健康 / Operations Tasks / Snapshot Receipts"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <PipelineHealthCard health={de.pipeline_health} failedTop={de.failed_top} requirementId={requirement.id} />
        </Col>
        <Col xs={24} lg={16}>
          <OpsByModuleCard byModule={de.ops_by_module} />
        </Col>
      </Row>
      <Card title={`Snapshot Receipts (${de.snapshots.length})`} style={{ marginBottom: 16 }}>
        <SnapshotTable snapshots={de.snapshots} />
      </Card>

      {/* ─── Section C · MLE ─── */}
      <SectionHeader
        role="mle"
        icon={<ExperimentOutlined />}
        title="算法工程师"
        subtitle={`Machine Learning Engineer · 1:N Datasets（${mle.customized_count} customized + ${mle.official_count} official）+ Training Impact + 闭环回流`}
      />

      <Card
        title={
          <Space>
            <span>Linked Datasets</span>
            <Tag color="blue">{mle.customized_count} customized</Tag>
            <Tag color="green">{mle.official_count} official</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              · 一个 Requirement 关联 N 个 Dataset（典型 1 customized + 1 official；多 release 时 N 更大）
            </Text>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <DatasetsTable datasets={mle.datasets} />
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Training Impact (跨所有 official datasets)">
            <Row gutter={16}>
              <Col span={8}><Statistic title="Total consumed" value={mle.training_impact_totals.consumed_count} /></Col>
              <Col span={8}><Statistic title="Train runs" value={mle.training_impact_totals.train_run_count} /></Col>
              <Col span={8}><Statistic title="Hard samples"
                                        value={mle.training_impact_totals.hard_sample_count}
                                        suffix={`/ ${mle.training_impact_totals.sample_count}`}
                                        valueStyle={mle.training_impact_totals.hard_sample_count > 0 ? { color: '#d97706' } : undefined} />
              </Col>
            </Row>
            {mle.training_impact_totals.consumed_count === 0 && (
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="还没有训练消费数据"
                description={<>等算工通过 dlkit SDK 上报后这里会出 ROI。详见 <Link to="/exports?tab=consumers">Consumers Tab</Link>。</>}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <ClosedLoopCard tasks={mle.loop_back_tasks} requirementId={requirement.id} />
        </Col>
      </Row>
    </PageContainer>
  )
}

// ─────────────────────────── sub-components ───────────────────────────

function PipelineHealthCard({
  health, failedTop, requirementId,
}: {
  health: { running: number; success: number; failed: number; pending: number }
  failedTop: Array<Record<string, unknown>>
  requirementId: string
}) {
  return (
    <Card title="Pipeline health" extra={<Link to={`/pipelines?tab=runs&requirement_id=${requirementId}`}>All runs →</Link>}>
      <Row gutter={8}>
        <Col span={8}>
          <Statistic title={<><ClockCircleOutlined /> Running</>} value={health.running} valueStyle={{ fontSize: 20, color: '#2563eb' }} />
        </Col>
        <Col span={8}>
          <Statistic title={<><CheckCircleOutlined /> Success</>} value={health.success} valueStyle={{ fontSize: 20, color: '#16a34a' }} />
        </Col>
        <Col span={8}>
          <Statistic title={<><CloseCircleOutlined /> Failed</>} value={health.failed} valueStyle={{ fontSize: 20, color: '#dc2626' }} />
        </Col>
      </Row>
      {failedTop.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Failed runs (top {failedTop.length})</Text>
          <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 4 }}>
            {failedTop.map((r, i) => (
              <div key={i} style={{ fontSize: 12 }}>
                <Tag color="red">{String(r.stage ?? '?')}</Tag>
                <Text>{String(r.pipeline_name ?? '?')}</Text>
              </div>
            ))}
          </Space>
        </div>
      )}
    </Card>
  )
}

function OpsByModuleCard({ byModule }: { byModule: Record<string, Array<Record<string, unknown>>> }) {
  const entries = Object.entries(byModule)
  if (entries.length === 0) {
    return <Card title="Operations Tasks by module"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ops tasks linked." /></Card>
  }
  return (
    <Card title="Operations Tasks by module">
      <Space wrap size={[12, 12]}>
        {entries.map(([module, items]) => {
          const completed = items.filter((t) => t.status === 'completed').length
          return (
            <Link key={module} to={`/ops/${module}`}>
              <Card
                size="small"
                className="clickable-card"
                style={{ minWidth: 150, textAlign: 'center' }}
              >
                <Text strong style={{ textTransform: 'capitalize' }}>{module}</Text>
                <div style={{ fontSize: 22, marginTop: 4 }}>{items.length}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {completed}/{items.length} completed
                </Text>
              </Card>
            </Link>
          )
        })}
      </Space>
    </Card>
  )
}

function SnapshotTable({ snapshots }: { snapshots: Array<Record<string, unknown>> }) {
  if (snapshots.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No snapshot manifests for this requirement." />
  }
  const cols: ColumnsType<Record<string, unknown>> = [
    { key: 'x_trace_id', title: 'x_trace_id', dataIndex: 'x_trace_id', width: 200,
      render: (v: string) => <IdCell value={v} variant="mono-ellipsis" maxWidth={170} /> },
    { key: 'title', title: 'Title', dataIndex: 'title', width: 220, render: (v) => <TableCellText value={v} maxWidth={220} /> },
    { key: 'export_format', title: 'Format', dataIndex: 'export_format', width: 90,
      render: (v) => v ? <Tag>{String(v)}</Tag> : <Text type="secondary">—</Text> },
    { key: 'sealed_at', title: 'Sealed at', dataIndex: 'sealed_at', width: 180,
      render: (v: string | null) => v ? <Text type="secondary">{new Date(v).toLocaleString()}</Text> : <Text type="secondary">—</Text> },
    { key: '_open', title: '', width: 80, render: (_: unknown, row) => (
      <Link to={`/exports?tab=snapshots&trace=${encodeURIComponent(String(row.x_trace_id ?? ''))}`}>open →</Link>
    )},
  ]
  return (
    <Table<Record<string, unknown>>
      className="app-data-table"
      rowKey={(r, i) => String(r.x_trace_id ?? i)}
      columns={cols}
      dataSource={snapshots}
      size="small"
      pagination={false}
      scroll={{ x: 800 }}
    />
  )
}

function DatasetsTable({ datasets }: { datasets: DatasetSummaryItem[] }) {
  if (datasets.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No datasets linked yet." />
  }
  const cols: ColumnsType<DatasetSummaryItem> = [
    { key: 'dataset_type', title: 'Type', dataIndex: 'dataset_type', width: 110,
      render: (t) => <Tag color={t === 'official' ? 'green' : 'blue'}>{t}</Tag> },
    { key: 'name', title: 'Dataset', width: 280,
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Link to={`/catalog/v2/${encodeURIComponent(row.id)}`} style={{ fontWeight: 500 }}>
            {row.name}
          </Link>
          <IdCell value={row.id} />
        </Space>
      ),
    },
    { key: 'dataset_version', title: 'Version', dataIndex: 'dataset_version', width: 90,
      render: (v: number) => `v${v}` },
    { key: 'allow_train', title: 'Trainable', dataIndex: 'allow_train', width: 90,
      render: (v) => v ? <Tag color="green">yes</Tag> : <Tag>no</Tag> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 110,
      render: (s: string) => <StatusBadge status={s} /> },
    { key: 'created_at', title: 'Created', dataIndex: 'created_at', width: 170,
      render: (v: string) => <Text type="secondary">{v ? new Date(v).toLocaleString() : '—'}</Text> },
  ]
  return (
    <Table<DatasetSummaryItem>
      className="app-data-table"
      rowKey="id"
      columns={cols}
      dataSource={datasets}
      size="small"
      pagination={false}
      scroll={{ x: 950 }}
    />
  )
}

function ClosedLoopCard({
  tasks, requirementId,
}: {
  tasks: Array<Record<string, unknown>>
  requirementId: string
}) {
  return (
    <Card
      title={
        <Space>
          <span>Closed-Loop（hard sample 触发的下一轮 mining）</span>
          <Tag color={tasks.length > 0 ? 'orange' : 'default'}>{tasks.length}</Tag>
        </Space>
      }
    >
      {tasks.length === 0 ? (
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          本需求暂无闭环回流任务。等 dlkit SDK 上报 loss 后，
          <Link to="/exports?tab=hard-samples">Hard Samples Tab</Link> 会自动 spawn 下一轮 mining task。
        </Paragraph>
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {tasks.slice(0, 5).map((t, i) => {
            const payload = (t.payload ?? {}) as Record<string, unknown>
            const parent = String(payload.parent_trace_id ?? '')
            const score = typeof payload.hard_score === 'number' ? payload.hard_score : null
            return (
              <Link key={i} to={`/ops/mining?x_trace_id=${encodeURIComponent(String(t.x_trace_id ?? ''))}`}>
                <Card size="small" className="clickable-card">
                  <Space>
                    {score != null && (
                      <Tag color={score >= 1 ? 'red' : 'orange'}>hard_score {score.toFixed(3)}</Tag>
                    )}
                    <Text>{String(t.title ?? 'mining task')}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <ArrowRightOutlined /> trace=<IdCell value={String(t.x_trace_id ?? '')} />
                      {parent && <> · parent=<IdCell value={parent} /></>}
                    </Text>
                  </Space>
                </Card>
              </Link>
            )
          })}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            点击进入 <Link to={`/ops/mining?requirement_id=${requirementId}`}>本需求的 Mining 列表</Link>
          </Text>
        </Space>
      )}
    </Card>
  )
}
