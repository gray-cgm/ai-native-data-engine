import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Col, Input, Progress, Row, Space, Table, Typography } from 'antd'
import { ExportOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@/shared/hooks/use-query'
import { PageContainer } from '@/shared/components/page-container'
import { PageLoading } from '@/shared/components/page-loading'
import { StatusBadge } from '@/shared/components/status-badge'
import { StatCard } from '@/shared/components/stat-card'
import type { RunItem, StreamingBatchSummary, StreamingSummary } from '@/shared/types/common'
import { fetchRuns, fetchStreamingSummary } from '../api'

const { Title, Text } = Typography
const PAGE_SIZE = 8

const EYEBROW: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 4,
}

// ── Filter helpers ────────────────────────────────────────────

function filterRun(run: RunItem, q: string) {
  return (
    run.job_name.toLowerCase().includes(q) ||
    run.run_id.toLowerCase().includes(q) ||
    run.status.toLowerCase().includes(q)
  )
}

function filterBatch(batch: StreamingBatchSummary, q: string) {
  return String(batch.batch_number).includes(q) || batch.run_status.toLowerCase().includes(q)
}

// ── useFilteredData ───────────────────────────────────────────

function useFilteredData<T>(items: T[], filterFn: (item: T, keyword: string) => boolean) {
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return q ? items.filter((item) => filterFn(item, q)) : items
  }, [items, keyword, filterFn])

  const onKeyword = useCallback((v: string) => setKeyword(v), [])

  return { keyword, onKeyword, filtered }
}

// ── Column definitions ────────────────────────────────────────

const batchRunColumns: ColumnsType<RunItem> = [
  {
    key: 'job_name',
    title: 'Job name',
    dataIndex: 'job_name',
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    render: (_: unknown, record) => <StatusBadge status={record.status} />,
  },
  {
    key: 'run_id',
    title: 'Run ID',
    dataIndex: 'run_id',
    render: (text: string) => (
      <Text code type="secondary" style={{ fontSize: 12 }}>
        {text.slice(0, 12)}…
      </Text>
    ),
  },
]

const streamingBatchColumns: ColumnsType<StreamingBatchSummary> = [
  {
    key: 'batch_number',
    title: 'Batch',
    dataIndex: 'batch_number',
    render: (val: number) => <Text strong>#{val}</Text>,
  },
  { key: 'input_events', title: 'Events in', dataIndex: 'input_events' },
  { key: 'accepted_events', title: 'Accepted', dataIndex: 'accepted_events' },
  { key: 'unique_samples', title: 'New samples', dataIndex: 'unique_samples' },
  {
    key: 'run_status',
    title: 'Run status',
    dataIndex: 'run_status',
    render: (_: unknown, record) => <StatusBadge status={record.run_status} />,
  },
]

// ── BatchRunsSection ──────────────────────────────────────────

function BatchRunsSection({ runs, loading }: { runs: RunItem[]; loading: boolean }) {
  const { keyword, onKeyword, filtered } = useFilteredData(runs, filterRun)

  return (
    <Card
      title={
        <>
          <Text type="secondary" style={EYEBROW}>Batch processing</Text>
          <Title level={4} style={{ margin: 0 }}>Dagster runs</Title>
        </>
      }
      extra={
        <Button type="link" href="http://localhost:3001" target="_blank" icon={<ExportOutlined />}>
          Open Dagster console
        </Button>
      }
    >
      {loading && <Text type="secondary">Loading runs…</Text>}

      {!loading && runs.length === 0 && (
        <Space direction="vertical" size={4}>
          <Text type="secondary">No batch runs recorded yet.</Text>
          <Text type="secondary">
            Run <Text code>make ingest</Text> or trigger a Dagster job to see results here.
          </Text>
        </Space>
      )}

      {!loading && runs.length > 0 && (
        <>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by job name, run ID or status…"
            allowClear
            value={keyword}
            onChange={(e) => onKeyword(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Table<RunItem>
            columns={batchRunColumns}
            dataSource={filtered}
            rowKey={(row) => row.run_id}
            size="small"
            pagination={{
              pageSize: PAGE_SIZE,
              size: 'small',
              showTotal: (t) => `${t} run${t !== 1 ? 's' : ''}`,
              showSizeChanger: false,
            }}
            locale={{ emptyText: `No runs match "${keyword}".` }}
          />
        </>
      )}

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
        <Link to="/tools/dagster">
          <Button type="link" size="small" style={{ padding: 0 }}>
            View full Dagster workspace →
          </Button>
        </Link>
      </div>
    </Card>
  )
}

// ── StreamingSection ──────────────────────────────────────────

function StreamingSection({ summary, loading }: { summary: StreamingSummary | null; loading: boolean }) {
  const batches = summary?.batch_summaries ?? []
  const { keyword, onKeyword, filtered } = useFilteredData(batches, filterBatch)

  return (
    <Card
      title={
        <>
          <Text type="secondary" style={EYEBROW}>Streaming processing</Text>
          <Title level={4} style={{ margin: 0 }}>Event pipeline</Title>
        </>
      }
    >
      {loading && <Text type="secondary">Loading summary…</Text>}

      {!loading && !summary && (
        <Space direction="vertical" size={4}>
          <Text type="secondary">No streaming data available yet.</Text>
          <Text type="secondary">
            Run <Text code>make lance</Text> to bootstrap the local streaming pipeline.
          </Text>
        </Space>
      )}

      {!loading && summary && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col span={6}><StatCard label="Total events" value={summary.event_count} /></Col>
            <Col span={6}><StatCard label="Deduplicated" value={summary.event_count - summary.duplicate_events_skipped} /></Col>
            <Col span={6}><StatCard label="Batches" value={summary.batch_count} /></Col>
            <Col span={6}><StatCard label="Latest samples" value={summary.latest_sample_count} /></Col>
          </Row>

          {summary.distribution.length > 0 && (
            <div>
              <Text type="secondary" style={{ ...EYEBROW, marginBottom: 10 }}>Scene distribution</Text>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {summary.distribution.map((row) => (
                  <div key={row.scene} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Text
                      strong
                      style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, fontSize: 13 }}
                    >
                      {row.scene}
                    </Text>
                    <Progress
                      percent={summary.latest_sample_count > 0 ? Math.round((row.sample_count / summary.latest_sample_count) * 100) : 0}
                      showInfo={false}
                      strokeColor={{ from: '#2175ff', to: '#4f9bff' }}
                      style={{ flex: 1, margin: 0 }}
                    />
                    <Text type="secondary" style={{ width: 40, textAlign: 'right', flexShrink: 0, fontSize: 13 }}>
                      {row.sample_count}
                    </Text>
                  </div>
                ))}
              </Space>
            </div>
          )}

          {batches.length > 0 && (
            <>
              <Input
                prefix={<SearchOutlined />}
                placeholder="Search by batch # or status…"
                allowClear
                value={keyword}
                onChange={(e) => onKeyword(e.target.value)}
              />
              <Table<StreamingBatchSummary>
                columns={streamingBatchColumns}
                dataSource={filtered}
                rowKey={(row) => String(row.batch_number)}
                size="small"
                pagination={{
                  pageSize: PAGE_SIZE,
                  size: 'small',
                  showTotal: (t) => `${t} batch${t !== 1 ? 'es' : ''}`,
                  showSizeChanger: false,
                }}
                locale={{ emptyText: `No batches match "${keyword}".` }}
              />
            </>
          )}
        </Space>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function RunHistoryPage() {
  const runsFetcher = useCallback(() => fetchRuns(), [])
  const streamFetcher = useCallback(() => fetchStreamingSummary(), [])

  const {
    data: runs,
    state: runsState,
    error: runsError,
    refetch: refetchRuns,
  } = useQuery(runsFetcher, {
    isEmpty: (d) => (d as RunItem[]).length === 0,
  })
  const { data: streaming, state: streamState, refetch: refetchStream } = useQuery(streamFetcher)

  if (runsState === 'loading' && streamState === 'loading') {
    return <PageLoading message="Loading pipeline data…" />
  }

  if (runsState === 'error') {
    return (
      <PageContainer title="Pipeline Monitor" description="Batch and streaming pipeline activity.">
        <Alert
          type="error"
          showIcon
          message="Failed to load pipeline runs"
          description={runsError?.message ?? 'An unexpected error occurred.'}
          action={<Button onClick={refetchRuns}>Retry</Button>}
        />
      </PageContainer>
    )
  }

  const runList = runs ?? []
  const doneCount = runList.filter((r) => r.status === 'done' || r.status === 'completed').length
  const failedCount = runList.filter((r) => r.status === 'failed').length

  return (
    <PageContainer
      title="Pipeline Monitor"
      description="Unified view of batch and streaming pipeline activity."
      actions={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void refetchRuns()
              void refetchStream()
            }}
          >
            Refresh
          </Button>
          <Button type="primary" href="http://localhost:3001" target="_blank">
            Open Dagster <ExportOutlined />
          </Button>
        </Space>
      }
    >
      <Row gutter={[14, 14]} style={{ marginBottom: 24 }}>
        <Col flex="1"><StatCard label="Total runs" value={runList.length} /></Col>
        <Col flex="1"><StatCard label="Completed" value={doneCount} /></Col>
        <Col flex="1"><StatCard label="Failed" value={failedCount} /></Col>
        <Col flex="1"><StatCard label="Streaming batches" value={streaming?.batch_count ?? '—'} /></Col>
        <Col flex="1"><StatCard label="Streaming events" value={streaming?.event_count ?? '—'} /></Col>
      </Row>

      <Row gutter={20} align="top">
        <Col xs={24} lg={12}>
          <BatchRunsSection runs={runList} loading={runsState === 'loading'} />
        </Col>
        <Col xs={24} lg={12}>
          <StreamingSection summary={streaming ?? null} loading={streamState === 'loading'} />
        </Col>
      </Row>
    </PageContainer>
  )
}
