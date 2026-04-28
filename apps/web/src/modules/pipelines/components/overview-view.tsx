import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Col, Input, Progress, Row, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { ApiOutlined, ExportOutlined, ReloadOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@/shared/hooks/use-query'
import { StatusBadge } from '@/shared/components/status-badge'
import { StatCard } from '@/shared/components/stat-card'
import { TableCellText } from '@/shared/components/table-cell-text'
import { getToolById, getToolEmbedUrl } from '@/shared/microfrontends/registry'
import type { RunItem } from '@/shared/types/common'
import type { StreamingHealth } from '../api'
import { fetchRuns, fetchStreamingHealth } from '../api'

const { Title, Text } = Typography
const PAGE_SIZE = 8

const EYEBROW: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 4,
}

function filterRun(run: RunItem, q: string) {
  return (
    run.job_name.toLowerCase().includes(q) ||
    run.run_id.toLowerCase().includes(q) ||
    run.status.toLowerCase().includes(q)
  )
}

function useFilteredData<T>(items: T[], filterFn: (item: T, keyword: string) => boolean) {
  const [keyword, setKeyword] = useState('')
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return q ? items.filter((item) => filterFn(item, q)) : items
  }, [items, keyword, filterFn])
  const onKeyword = useCallback((v: string) => setKeyword(v), [])
  return { keyword, onKeyword, filtered }
}

const batchRunColumns: ColumnsType<RunItem> = [
  { key: 'job_name', title: 'Job name', dataIndex: 'job_name', width: 220,
    render: (text: string) => <TableCellText value={text} maxWidth={220} /> },
  { key: 'status', title: 'Status', dataIndex: 'status', width: 110,
    render: (_: unknown, record) => <StatusBadge status={record.status} /> },
  { key: 'requirement_id', title: 'Requirement', dataIndex: 'requirement_id', width: 180,
    render: (t?: string | null) => <TableCellText value={t} maxWidth={180} /> },
  { key: 'operation_task_id', title: 'Ops Task', dataIndex: 'operation_task_id', width: 210,
    render: (t?: string | null) => <TableCellText value={t} maxWidth={210} /> },
  { key: 'estimated_cost', title: 'Est. Cost', dataIndex: 'estimated_cost', width: 110,
    render: (v?: number | null) => (typeof v === 'number' ? `$${v.toFixed(4)}` : '—') },
  { key: 'duration_seconds', title: 'Duration(s)', dataIndex: 'duration_seconds', width: 110,
    render: (v?: number | null) => (typeof v === 'number' ? Math.round(v) : '—') },
  { key: 'run_id', title: 'Run ID', dataIndex: 'run_id', width: 180,
    render: (text: string) => <TableCellText value={text} maxWidth={180} code /> },
]

function BatchRunsSection({ runs, loading }: { runs: RunItem[]; loading: boolean }) {
  const { keyword, onKeyword, filtered } = useFilteredData(runs, filterRun)
  const dagsterTool = getToolById('dagster')
  const dagsterUrl = dagsterTool ? getToolEmbedUrl(dagsterTool) : 'http://localhost:3001'
  return (
    <Card
      title={<><Text type="secondary" style={EYEBROW}>Batch processing</Text><Title level={4} style={{ margin: 0 }}>Dagster runs</Title></>}
      extra={<Button type="link" href={dagsterUrl} target="_blank" icon={<ExportOutlined />}>Open Dagster console</Button>}
    >
      {loading && <Text type="secondary">Loading runs…</Text>}
      {!loading && runs.length === 0 && (
        <Space direction="vertical" size={4}>
          <Text type="secondary">No batch runs recorded yet.</Text>
          <Text type="secondary">Run <Text code>make ingest</Text> or trigger a Dagster job to see results here.</Text>
        </Space>
      )}
      {!loading && runs.length > 0 && (
        <>
          <Input prefix={<SearchOutlined />} placeholder="Search by job name, run ID or status…"
            allowClear value={keyword} onChange={(e) => onKeyword(e.target.value)} style={{ marginBottom: 16 }} />
          <Table<RunItem> className="app-data-table" columns={batchRunColumns} dataSource={filtered}
            rowKey={(row) => row.run_id} size="small" tableLayout="fixed" scroll={{ x: 'max-content' }}
            pagination={{ pageSize: PAGE_SIZE, size: 'small', showTotal: (t) => `${t} run${t !== 1 ? 's' : ''}`, showSizeChanger: false }}
            locale={{ emptyText: `No runs match "${keyword}".` }} />
        </>
      )}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
        <Link to="/tools/dagster"><Button type="link" size="small" style={{ padding: 0 }}>View full Dagster workspace →</Button></Link>
      </div>
    </Card>
  )
}

const STREAM_STATUS_TEXT: Record<string, string> = {
  healthy: 'Healthy',
  lagging: 'Lagging',
  degraded: 'Degraded',
  idle: 'Idle (consumer not running)',
  unknown: 'Unknown',
  down: 'Broker unreachable',
}

const STREAM_STATUS_COLOR: Record<string, string> = {
  healthy: 'green',
  lagging: 'orange',
  degraded: 'red',
  idle: 'default',
  unknown: 'default',
  down: 'red',
}

function StreamingHealthBlock({ health }: { health: StreamingHealth | null | undefined }) {
  if (!health) return null
  const consumer = health.platform?.consumer
  const broker = health.platform?.broker
  const counters = consumer?.counters ?? {}
  const totalLag = consumer?.total_lag ?? 0
  const partitionLag = consumer?.partition_lag ?? []
  const consumerStatus = consumer?.status ?? 'unknown'
  const kafkaUiStatus = health.kafka_ui?.status ?? 'down'

  const polled = Number(counters.polled ?? 0)
  const accepted = Number(counters.accepted ?? 0)
  const duplicates = Number(counters.duplicates ?? 0)
  const dlq = Number(counters.dlq ?? 0)

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap size={[8, 8]}>
        <Tag color={STREAM_STATUS_COLOR[consumerStatus] ?? 'default'} icon={<ThunderboltOutlined />}>
          Consumer · {STREAM_STATUS_TEXT[consumerStatus] ?? consumerStatus}
        </Tag>
        <Tag color={STREAM_STATUS_COLOR[kafkaUiStatus] ?? 'default'} icon={<ApiOutlined />}>
          Kafka UI · {STREAM_STATUS_TEXT[kafkaUiStatus] ?? kafkaUiStatus}
        </Tag>
        {broker && (
          <Tooltip title={`Bootstrap: ${broker.bootstrap_servers} · Group: ${broker.consumer_group}`}>
            <Tag>{broker.topic_events}</Tag>
          </Tooltip>
        )}
        {broker && <Tag color="purple">DLQ · {broker.topic_dlq}</Tag>}
      </Space>

      <Row gutter={[10, 10]}>
        <Col span={8}><StatCard label="Total lag" value={totalLag} /></Col>
        <Col span={8}><StatCard label="Accepted" value={accepted} /></Col>
        <Col span={8}><StatCard label="Polled" value={polled} /></Col>
        <Col span={8}><StatCard label="Duplicates" value={duplicates} /></Col>
        <Col span={8}><StatCard label="DLQ" value={dlq} /></Col>
        <Col span={8}>
          <StatCard
            label="Last event"
            value={counters.last_event_at ? new Date(String(counters.last_event_at)).toLocaleTimeString() : '—'}
          />
        </Col>
      </Row>

      {partitionLag.length > 0 && (
        <div>
          <Text type="secondary" style={{ ...EYEBROW, marginBottom: 8 }}>Partition lag</Text>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {partitionLag.map((p) => {
              const pct = p.end_offset > 0 ? Math.min(100, Math.round((p.lag / p.end_offset) * 100)) : 0
              return (
                <div key={`${p.topic}-${p.partition}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text strong style={{ width: 180, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.topic}#{p.partition}
                  </Text>
                  <Progress
                    percent={pct}
                    showInfo={false}
                    strokeColor={p.lag > 0 ? '#faad14' : '#52c41a'}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <Text type="secondary" style={{ width: 110, textAlign: 'right', fontSize: 12 }}>
                    {p.current_offset}/{p.end_offset} (+{p.lag})
                  </Text>
                </div>
              )
            })}
          </Space>
        </div>
      )}

      {consumerStatus === 'idle' && (
        <Alert
          type="info"
          showIcon
          message="Streaming consumer is not running"
          description={(
            <span>
              Run <Text code>make up-deps</Text> then <Text code>make stream-kafka-consumer</Text> to start consuming
              <Text code style={{ marginLeft: 4 }}>{broker?.topic_events ?? 'streaming.events.raw'}</Text>.
            </span>
          )}
        />
      )}

      {kafkaUiStatus === 'down' && (
        <Alert
          type="warning"
          showIcon
          message="Kafka UI is unreachable"
          description={health.kafka_ui?.detail ?? `No response from ${health.kafka_ui?.endpoint ?? 'kafka-ui'}.`}
        />
      )}
    </Space>
  )
}

function StreamingSection({ health }: { health: StreamingHealth | null | undefined }) {
  const kafkaUiTool = getToolById('kafka-ui')
  const kafkaUiUrl = kafkaUiTool ? getToolEmbedUrl(kafkaUiTool) : (health?.kafka_ui?.base_url ?? 'http://localhost:8085')
  return (
    <Card
      title={<><Text type="secondary" style={EYEBROW}>Streaming processing</Text><Title level={4} style={{ margin: 0 }}>Kafka event pipeline</Title></>}
      extra={
        <Button type="link" href={kafkaUiUrl} target="_blank" icon={<ExportOutlined />}>
          Open Kafka UI console
        </Button>
      }
    >
      <StreamingHealthBlock health={health} />
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
        <Link to="/tools/kafka-ui"><Button type="link" size="small" style={{ padding: 0 }}>View full Kafka UI workspace →</Button></Link>
      </div>
    </Card>
  )
}

export function OverviewView() {
  const runsFetcher = useCallback(() => fetchRuns(), [])
  const healthFetcher = useCallback(() => fetchStreamingHealth().catch(() => null), [])
  const { data: runs, state: runsState, error: runsError, refetch: refetchRuns } = useQuery(runsFetcher, { isEmpty: (d) => (d as RunItem[]).length === 0 })
  const { data: health } = useQuery(healthFetcher)

  if (runsState === 'error') {
    return <Alert type="error" showIcon message="Failed to load pipeline runs" description={runsError?.message ?? 'An unexpected error occurred.'} action={<Button onClick={refetchRuns}><ReloadOutlined /> Retry</Button>} />
  }

  const runList = runs ?? []
  const doneCount = runList.filter((r) => r.status === 'done' || r.status === 'completed').length
  const failedCount = runList.filter((r) => r.status === 'failed').length
  const counters = health?.platform?.consumer?.counters ?? {}
  const acceptedEvents = Number(counters.accepted ?? 0)
  const totalLag = health?.platform?.consumer?.total_lag ?? null
  const consumerStatus = health?.platform?.consumer?.status ?? 'unknown'
  const dlqCount = Number(counters.dlq ?? 0)

  return (
    <>
      <Row gutter={[14, 14]} style={{ marginBottom: 24 }}>
        <Col flex="1"><StatCard label="Batch runs" value={runList.length} /></Col>
        <Col flex="1"><StatCard label="Batch completed" value={doneCount} /></Col>
        <Col flex="1"><StatCard label="Batch failed" value={failedCount} /></Col>
        <Col flex="1"><StatCard label="Streaming accepted" value={acceptedEvents} /></Col>
        <Col flex="1"><StatCard label="Kafka lag" value={totalLag === null ? '—' : totalLag} /></Col>
        <Col flex="1"><StatCard label="DLQ" value={dlqCount} /></Col>
      </Row>
      <Row gutter={20} align="top">
        <Col xs={24} lg={12}><BatchRunsSection runs={runList} loading={runsState === 'loading'} /></Col>
        <Col xs={24} lg={12}><StreamingSection health={health ?? null} /></Col>
      </Row>
      {consumerStatus === 'unknown' && health?.platform && 'error' in health.platform && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message="Streaming health unavailable"
          description={(health.platform as { error: string }).error}
        />
      )}
    </>
  )
}
