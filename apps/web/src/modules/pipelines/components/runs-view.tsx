import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useSearchParams } from 'react-router-dom'
import { StatusBadge } from '@/shared/components/status-badge'
import { TableCellText } from '@/shared/components/table-cell-text'
import { IdCell } from '@/shared/components/id-cell'
import type { PipelineRunFilters, PipelineRunRow } from '../api'
import { fetchPipelineRuns } from '../api'
import { RunDetailDrawer } from './run-detail.drawer'

const { Text } = Typography

// stage 已降级为自由文本 step 名（v3）。这里给出 demo / orchestrator 中常用的标签便于过滤；
// 用户也可以输入任意值。
const STAGE_OPTIONS = ['collect', 'clip-extract', 'feature-compute', 'release', 'streaming-replay']
const STATUS_OPTIONS = ['pending', 'running', 'success', 'failed']
const TRIGGER_OPTIONS = ['data_task', 'operations_task', 'scheduler', 'manual', 'external']
const PURPOSE_OPTIONS = ['initial_build', 'backfill', 'repair', 'reindex', 'replay', 'validation']

const FILTER_KEYS: Array<keyof PipelineRunFilters> = [
  'requirement_id',
  'data_task_id',
  'operations_task_id',
  'x_trace_id',
  'stage',
  'status',
  'trigger_source',
  'run_purpose',
]

function filtersFromSearchParams(params: URLSearchParams): PipelineRunFilters {
  const out: PipelineRunFilters = {}
  for (const key of FILTER_KEYS) {
    const v = params.get(key)
    if (v) out[key] = v
  }
  return out
}

export function RunsView() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<PipelineRunFilters>(() => filtersFromSearchParams(searchParams))
  const [rows, setRows] = useState<PipelineRunRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  // Sync filters if URL search params change (e.g. navigated with ?data_task_id=...)
  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams))
  }, [searchParams])

  const load = useCallback((f: PipelineRunFilters) => {
    setLoading(true)
    setError(null)
    fetchPipelineRuns(f)
      .then((items) => setRows(items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(filters) }, [load, filters])

  const columns: ColumnsType<PipelineRunRow> = useMemo(() => [
    { key: 'pipeline_name', title: 'Pipeline', dataIndex: 'pipeline_name', width: 160,
      render: (t: string) => <TableCellText value={t} maxWidth={160} /> },
    { key: 'stage', title: 'Stage', dataIndex: 'stage', width: 150,
      render: (t: string) => <Tag>{t}</Tag> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 100,
      render: (t: string) => <StatusBadge status={t} /> },
    { key: 'trigger_source', title: 'Trigger', dataIndex: 'trigger_source', width: 130,
      render: (t: string) => <Tag color="orange">{t}</Tag> },
    { key: 'run_purpose', title: 'Purpose', dataIndex: 'run_purpose', width: 120,
      render: (t: string) => <Tag color="magenta">{t}</Tag> },
    { key: 'x_trace_id', title: 'x_trace_id', dataIndex: 'x_trace_id', width: 200,
      render: (t?: string | null) => <IdCell value={t} variant="mono-ellipsis" maxWidth={160} /> },
    { key: 'requirement_id', title: 'Requirement', dataIndex: 'requirement_id', width: 160,
      render: (t?: string | null) => <IdCell value={t} /> },
    { key: 'operations_task_id', title: 'Ops Task', dataIndex: 'operations_task_id', width: 160,
      render: (t?: string | null) => <IdCell value={t} /> },
    { key: 'created_at', title: 'Created', dataIndex: 'created_at', width: 160,
      render: (t: string) => <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text> },
  ], [])

  const set = (key: keyof PipelineRunFilters) => (v?: string) => {
    setFilters((prev) => ({ ...prev, [key]: v || undefined }))
  }

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={[10, 10]}>
          <Input placeholder="x_trace_id" allowClear style={{ width: 220 }}
            value={filters.x_trace_id ?? ''}
            onChange={(e) => set('x_trace_id')(e.target.value)} />
          <Input placeholder="requirement_id" allowClear style={{ width: 260 }}
            value={filters.requirement_id ?? ''}
            onChange={(e) => set('requirement_id')(e.target.value)} />
          <Input placeholder="data_task_id" allowClear style={{ width: 260 }}
            value={filters.data_task_id ?? ''}
            onChange={(e) => set('data_task_id')(e.target.value)} />
          <Input placeholder="operations_task_id" allowClear style={{ width: 260 }}
            value={filters.operations_task_id ?? ''}
            onChange={(e) => set('operations_task_id')(e.target.value)} />
          <Select placeholder="stage" allowClear style={{ width: 160 }}
            value={filters.stage} onChange={(v) => set('stage')(v)}
            options={STAGE_OPTIONS.map((o) => ({ label: o, value: o }))} />
          <Select placeholder="status" allowClear style={{ width: 130 }}
            value={filters.status} onChange={(v) => set('status')(v)}
            options={STATUS_OPTIONS.map((o) => ({ label: o, value: o }))} />
          <Select placeholder="trigger" allowClear style={{ width: 160 }}
            value={filters.trigger_source} onChange={(v) => set('trigger_source')(v)}
            options={TRIGGER_OPTIONS.map((o) => ({ label: o, value: o }))} />
          <Select placeholder="purpose" allowClear style={{ width: 160 }}
            value={filters.run_purpose} onChange={(v) => set('run_purpose')(v)}
            options={PURPOSE_OPTIONS.map((o) => ({ label: o, value: o }))} />
          <Button onClick={() => setFilters({})}>Clear</Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(filters)}>Refresh</Button>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message="Failed to load pipeline runs" description={error} style={{ marginBottom: 16 }} />}

      <Table<PipelineRunRow>
        className="app-data-table"
        columns={columns}
        dataSource={rows}
        rowKey={(r) => r.id}
        loading={loading}
        size="small"
        tableLayout="fixed"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} run${t !== 1 ? 's' : ''}` }}
        rowClassName={(record) =>
          'clickable-row' + (record.id === selectedRunId ? ' clickable-row--selected' : '')
        }
        onRow={(record) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (target.closest('a, button')) return
            setSelectedRunId(record.id)
          },
          tabIndex: 0,
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setSelectedRunId(record.id)
          },
        })}
        locale={{ emptyText: '无匹配的 Pipeline Run。尝试调整过滤条件或运行 make seed-trace-demo。' }}
      />

      <RunDetailDrawer
        runId={selectedRunId}
        open={!!selectedRunId}
        onClose={() => setSelectedRunId(null)}
      />
    </>
  )
}
