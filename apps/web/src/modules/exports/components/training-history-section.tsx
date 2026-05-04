import { useEffect, useState } from 'react'
import { Alert, Card, Collapse, Empty, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { IdCell } from '@/shared/components/id-cell'
import { fetchUsage, type ConsumptionEvent } from '../api'

const { Text } = Typography

interface Props {
  clipId: string
  /** Optional dataset filter; usually clip belongs to multiple datasets */
  datasetId?: string
}

/** Embedded section for explorer clip detail. Lists every consumption event
 *  whose sample_uid starts with `<datasetId>:<clipId>:` (or just `:<clipId>:`
 *  if dataset is unknown — uses postgres-style LIKE). */
export function TrainingHistorySection({ clipId, datasetId }: Props) {
  const [events, setEvents] = useState<ConsumptionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    // sample_uid format: dataset_id:clip_id:ts; with dataset known we can
    // anchor the LIKE prefix; without it we'd need wildcard in middle (P3).
    if (!datasetId) {
      setLoading(false)
      return
    }
    fetchUsage({ sample_uid_prefix: `${datasetId}:${clipId}:`, limit: 200 })
      .then((r) => { if (!cancelled) setEvents(r.items) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [clipId, datasetId])

  const losses = events.map((e) => e.loss).filter((v): v is number => v != null)
  const meanLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null
  const trainRuns = new Set(events.map((e) => e.train_run_id))
  const snapshots = new Set(events.map((e) => e.snapshot_trace))

  const eventColumns: ColumnsType<ConsumptionEvent> = [
    { key: 'ts', title: 'Reported at', dataIndex: 'ts', width: 180,
      render: (t: string | null) => <Text type="secondary">{t ? new Date(t).toLocaleString() : '—'}</Text> },
    { key: 'epoch', title: 'Epoch', dataIndex: 'epoch', width: 70, align: 'right' as const },
    { key: 'step', title: 'Step', dataIndex: 'step', width: 80, align: 'right' as const },
    { key: 'loss', title: 'Loss', dataIndex: 'loss', width: 90, align: 'right' as const,
      render: (v: number | null) => v == null ? <Text type="secondary">—</Text> : v.toFixed(4) },
    { key: 'train_run_id', title: 'Train run', dataIndex: 'train_run_id', width: 220,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={180} /> },
    { key: 'snapshot_trace', title: 'Snapshot', dataIndex: 'snapshot_trace', width: 220,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={180} /> },
  ]

  const summary = (
    <Space size={24} wrap>
      <Statistic title="Consumed" value={events.length} valueStyle={{ fontSize: 18 }} />
      <Statistic title="Train runs" value={trainRuns.size} valueStyle={{ fontSize: 18 }} />
      <Statistic title="Snapshots" value={snapshots.size} valueStyle={{ fontSize: 18 }} />
      {meanLoss != null && (
        <Statistic title="Mean loss" value={meanLoss} precision={3} valueStyle={{ fontSize: 18 }} />
      )}
    </Space>
  )

  if (!datasetId) {
    return (
      <Card title="Training History" size="small">
        <Alert
          type="info"
          showIcon
          message="此页面 URL 需带 ?dataset=… 才能查询 clip 训练历史（sample_uid 格式：dataset:clip:ts）。"
        />
      </Card>
    )
  }

  return (
    <Card title="Training History" size="small" loading={loading}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {!loading && events.length === 0 ? (
        <Empty
          description={
            <Text type="secondary">
              此 clip 在 dataset {datasetId.slice(0, 8)}… 内还没有训练消费记录。
            </Text>
          }
        />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {summary}
          <Collapse
            size="small"
            items={[{
              key: 'events',
              label: <Text>Loss timeline ({events.length} events)</Text>,
              children: (
                <Table<ConsumptionEvent>
                  className="app-data-table"
                  rowKey="id"
                  size="small"
                  columns={eventColumns}
                  dataSource={events}
                  pagination={{ pageSize: 50, showSizeChanger: false }}
                  scroll={{ x: 900 }}
                />
              ),
            }]}
          />
          <Tag>
            <Link to={`/exports?tab=hard-samples&dataset_id=${encodeURIComponent(datasetId)}`}>
              View dataset hard samples →
            </Link>
          </Tag>
        </Space>
      )}
    </Card>
  )
}
