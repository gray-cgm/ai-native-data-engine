import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Drawer, Empty, Input, Select, Space, Spin, Statistic, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { IdCell } from '@/shared/components/id-cell'
import { TableCellText } from '@/shared/components/table-cell-text'
import { fetchTrainRuns, fetchUsage, type ConsumptionEvent, type TrainRun } from '../api'

const { Text } = Typography

const STATUS_OPTIONS = ['running', 'completed', 'failed', 'unknown']

function formatTs(ts: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

export function ConsumersView() {
  const [filters, setFilters] = useState<{ consumer?: string; status?: string }>({})
  const [rows, setRows] = useState<TrainRun[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<TrainRun | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetchTrainRuns({ ...filters, limit: 200 })
      .then((res) => setRows(res.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  const columns: ColumnsType<TrainRun> = useMemo(() => [
    { key: 'name', title: 'Name', dataIndex: 'name', width: 180,
      render: (t: string | null) => <TableCellText value={t} maxWidth={180} /> },
    { key: 'consumer', title: 'Consumer', dataIndex: 'consumer', width: 160,
      render: (t: string | null) => <TableCellText value={t} maxWidth={160} /> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 100,
      render: (s: string) => (
        <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'blue'}>{s}</Tag>
      ),
    },
    { key: 'snapshot_count', title: 'Snapshots', width: 90, align: 'right' as const,
      render: (_: unknown, row) => row.snapshot_ids?.length ?? 0 },
    { key: 'external_run_id', title: 'External run', dataIndex: 'external_run_id', width: 200,
      render: (t: string | null) => <IdCell value={t} variant="mono-ellipsis" maxWidth={170} /> },
    { key: 'model_version', title: 'Model', dataIndex: 'model_version', width: 130,
      render: (t: string | null) => <TableCellText value={t} maxWidth={130} /> },
    { key: 'x_trace_id', title: 'x_trace_id', dataIndex: 'x_trace_id', width: 200,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={170} /> },
    { key: 'started_at', title: 'Started', dataIndex: 'started_at', width: 170,
      render: (t: string | null) => <Text type="secondary">{formatTs(t)}</Text> },
    { key: 'finished_at', title: 'Finished', dataIndex: 'finished_at', width: 170,
      render: (t: string | null) => <Text type="secondary">{formatTs(t)}</Text> },
  ], [])

  const summary = useMemo(() => ({
    total: rows.length,
    running: rows.filter((r) => r.status === 'running').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  }), [rows])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space size={32} wrap>
          <Statistic title="Train runs" value={summary.total} />
          <Statistic title="Running" value={summary.running} valueStyle={{ color: '#2563eb' }} />
          <Statistic title="Completed" value={summary.completed} valueStyle={{ color: '#16a34a' }} />
          <Statistic title="Failed" value={summary.failed} valueStyle={{ color: '#dc2626' }} />
        </Space>
      </Card>

      <Card size="small">
        <Space wrap>
          <Input
            placeholder="Filter by consumer"
            allowClear
            style={{ width: 220 }}
            value={filters.consumer ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, consumer: e.target.value || undefined }))}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 140 }}
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} />}

      <Table<TrainRun>
        className="app-data-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        rowClassName={(row) =>
          'clickable-row' + (row.id === selectedRun?.id ? ' clickable-row--selected' : '')
        }
        onRow={(row) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (target.closest('a, button, [data-stop-row-click]')) return
            setSelectedRun(row)
          },
          tabIndex: 0,
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setSelectedRun(row)
          },
        })}
        scroll={{ x: 1500 }}
        locale={{ emptyText: '暂无 train_run。等待 dlkit SDK 上报或人工 POST /api/v1/exports/train-runs。' }}
      />

      <TrainRunDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
    </Space>
  )
}

interface DrawerProps {
  run: TrainRun | null
  onClose: () => void
}

function TrainRunDrawer({ run, onClose }: DrawerProps) {
  const [events, setEvents] = useState<ConsumptionEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  useEffect(() => {
    if (!run) { setEvents([]); return }
    setEventsLoading(true)
    fetchUsage({ train_run_id: run.id, limit: 200 })
      .then((res) => setEvents(res.items))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false))
  }, [run])

  const eventColumns: ColumnsType<ConsumptionEvent> = useMemo(() => [
    { key: 'sample_uid', title: 'Sample', dataIndex: 'sample_uid', width: 260,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={220} /> },
    { key: 'epoch', title: 'Epoch', dataIndex: 'epoch', width: 70, align: 'right' as const },
    { key: 'step', title: 'Step', dataIndex: 'step', width: 80, align: 'right' as const },
    { key: 'loss', title: 'Loss', dataIndex: 'loss', width: 90, align: 'right' as const,
      render: (v: number | null) => v == null ? <Text type="secondary">—</Text> : v.toFixed(4) },
    { key: 'ts', title: 'Reported at', dataIndex: 'ts', width: 180,
      render: (t: string | null) => <Text type="secondary">{formatTs(t)}</Text> },
  ], [])

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0}>
          <Text strong>{run?.name ?? 'Train run'}</Text>
          {run ? <IdCell value={run.id} variant="full" /> : null}
        </Space>
      }
      width={760}
      open={!!run}
      onClose={onClose}
      destroyOnClose
    >
      {!run ? null : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space size={32} wrap>
            <Statistic title="Status" value={run.status} valueStyle={{ fontSize: 18 }} />
            <Statistic title="Snapshots" value={run.snapshot_ids?.length ?? 0} />
            <Statistic title="Events" value={events.length} />
          </Space>

          <div>
            <Text strong>Snapshots</Text>
            <div style={{ marginTop: 8 }}>
              {(run.snapshot_ids ?? []).length === 0 ? (
                <Text type="secondary">—</Text>
              ) : (
                <Space direction="vertical" size={4}>
                  {(run.snapshot_ids ?? []).map((trace) => (
                    <IdCell key={trace} value={trace} variant="full" />
                  ))}
                </Space>
              )}
            </div>
          </div>

          <div>
            <Text strong>Consumption events ({events.length})</Text>
            {eventsLoading ? (
              <div style={{ marginTop: 12 }}><Spin /></div>
            ) : events.length === 0 ? (
              <Empty
                style={{ marginTop: 12 }}
                description="此 run 还未上报 sample 消费事件。安装 dlkit SDK 调用 run.report(sample_uid=...)。"
              />
            ) : (
              <Table<ConsumptionEvent>
                className="app-data-table"
                style={{ marginTop: 12 }}
                rowKey="id"
                size="small"
                columns={eventColumns}
                dataSource={events}
                pagination={{ pageSize: 50, showSizeChanger: false }}
                scroll={{ x: 760 }}
              />
            )}
          </div>
        </Space>
      )}
    </Drawer>
  )
}
