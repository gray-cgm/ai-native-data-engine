import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { TableCellText } from '@/shared/components/table-cell-text'
import { IdCell } from '@/shared/components/id-cell'
import type { ExportSnapshot, SnapshotsFilters, SnapshotsListResponse } from '../api'
import { fetchSnapshots } from '../api'
import { SnapshotDetailDrawer } from './snapshot-detail.drawer'

const STATE_TAG: Record<ExportSnapshot['consumption_state'], { color: string; label: string }> = {
  used: { color: 'green', label: 'used' },
  fresh: { color: 'blue', label: 'fresh' },
  cold: { color: 'default', label: 'cold' },
}

function formatTs(ts: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

export function SnapshotsView() {
  const [filters, setFilters] = useState<SnapshotsFilters>({ limit: 100 })
  const [data, setData] = useState<SnapshotsListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)

  const load = useCallback((f: SnapshotsFilters) => {
    setLoading(true)
    setError(null)
    fetchSnapshots(f)
      .then((res) => setData(res))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(filters) }, [load, filters])

  const columns: ColumnsType<ExportSnapshot> = useMemo(() => [
    { key: 'title', title: 'Snapshot', dataIndex: 'title', width: 220,
      render: (t: string | null, row) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <TableCellText value={t ?? row.x_trace_id} maxWidth={220} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.scenario ?? '—'}
          </Typography.Text>
        </Space>
      ),
    },
    { key: 'x_trace_id', title: 'x_trace_id', dataIndex: 'x_trace_id', width: 220,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={180} /> },
    { key: 'dataset_id', title: 'Dataset', dataIndex: 'dataset_id', width: 200,
      render: (t: string | null) => <IdCell value={t} variant="mono-ellipsis" maxWidth={160} /> },
    { key: 'export_format', title: 'Format', dataIndex: 'export_format', width: 90,
      render: (t: string | null) => t ? <Tag>{t}</Tag> : <span className="text-muted">—</span> },
    { key: 'state', title: 'State', dataIndex: 'consumption_state', width: 90,
      render: (s: ExportSnapshot['consumption_state']) => (
        <Tag color={STATE_TAG[s].color}>{STATE_TAG[s].label}</Tag>
      ),
    },
    { key: 'train_run_count', title: 'Runs', dataIndex: 'train_run_count', width: 70, align: 'right' as const },
    { key: 'consumed_count', title: 'Samples', dataIndex: 'consumed_count', width: 100, align: 'right' as const,
      render: (n: number) => n.toLocaleString() },
    { key: 'last_consumed_at', title: 'Last consumed', dataIndex: 'last_consumed_at', width: 180,
      render: (t: string | null) => <span className="text-muted">{formatTs(t)}</span> },
    { key: 'sealed_at', title: 'Sealed at', dataIndex: 'sealed_at', width: 180,
      render: (t: string | null) => <span className="text-muted">{formatTs(t)}</span> },
  ], [])

  const summary = data?.summary

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {summary && (
        <Card size="small">
          <Row gutter={16}>
            <Col span={6}><Statistic title="Snapshots" value={summary.total} /></Col>
            <Col span={6}><Statistic title="Used" value={summary.used} valueStyle={{ color: '#16a34a' }} /></Col>
            <Col span={6}><Statistic title="Fresh" value={summary.fresh} valueStyle={{ color: '#2563eb' }} /></Col>
            <Col span={6}><Statistic title="Cold" value={summary.cold} valueStyle={{ color: '#6b7280' }} /></Col>
          </Row>
        </Card>
      )}

      <Card size="small">
        <Space wrap>
          <Input
            placeholder="Filter by dataset_id"
            allowClear
            style={{ width: 220 }}
            value={filters.dataset_id ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dataset_id: e.target.value || undefined }))}
          />
          <Input
            placeholder="Filter by scenario"
            allowClear
            style={{ width: 180 }}
            value={filters.scenario ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, scenario: e.target.value || undefined }))}
          />
          <Select
            placeholder="Consumed"
            allowClear
            style={{ width: 140 }}
            value={filters.consumed}
            onChange={(v) => setFilters((f) => ({ ...f, consumed: v }))}
            options={[
              { value: 'yes', label: 'consumed' },
              { value: 'no', label: 'never consumed' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(filters)} loading={loading}>
            Reload
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} />}

      <Table<ExportSnapshot>
        className="app-data-table"
        rowKey="x_trace_id"
        loading={loading}
        columns={columns}
        dataSource={data?.items ?? []}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        rowClassName={(row) =>
          'clickable-row' + (row.x_trace_id === selectedTrace ? ' clickable-row--selected' : '')
        }
        onRow={(row) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (target.closest('a, button')) return
            setSelectedTrace(row.x_trace_id)
          },
          tabIndex: 0,
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setSelectedTrace(row.x_trace_id)
          },
        })}
        scroll={{ x: 1300 }}
      />

      <SnapshotDetailDrawer
        traceId={selectedTrace}
        onClose={() => setSelectedTrace(null)}
        onChanged={() => load(filters)}
      />
    </Space>
  )
}
