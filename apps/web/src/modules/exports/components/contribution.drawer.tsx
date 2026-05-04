import { useEffect, useState } from 'react'
import { Alert, Drawer, Empty, Space, Spin, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { IdCell } from '@/shared/components/id-cell'
import { fetchContribution, type SampleContribution } from '../api'

const { Text } = Typography

type EventRow = SampleContribution['events'][number]

interface Props {
  sampleUid: string | null
  onClose: () => void
}

export function ContributionDrawer({ sampleUid, onClose }: Props) {
  const [data, setData] = useState<SampleContribution | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sampleUid) { setData(null); setError(null); return }
    setLoading(true); setError(null)
    fetchContribution(sampleUid)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sampleUid])

  const eventColumns: ColumnsType<EventRow> = [
    { key: 'ts', title: 'Reported at', dataIndex: 'ts', width: 180,
      render: (t: string | null) => <Text type="secondary">{t ? new Date(t).toLocaleString() : '—'}</Text> },
    { key: 'epoch', title: 'Epoch', dataIndex: 'epoch', width: 70, align: 'right' as const },
    { key: 'step', title: 'Step', dataIndex: 'step', width: 80, align: 'right' as const },
    { key: 'loss', title: 'Loss', dataIndex: 'loss', width: 90, align: 'right' as const,
      render: (v: number | null) => v == null ? <Text type="secondary">—</Text> : v.toFixed(4) },
    { key: 'train_run_id', title: 'Train run', dataIndex: 'train_run_id', width: 220,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={180} /> },
  ]

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0}>
          <Text strong>Sample contribution</Text>
          {sampleUid ? <IdCell value={sampleUid} variant="full" /> : null}
        </Space>
      }
      width={780}
      open={!!sampleUid}
      onClose={onClose}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {loading && !data && <Spin />}
      {data && data.consumed_count === 0 && (
        <Empty description="此 sample 还没被任何训练消费过。" />
      )}
      {data && data.consumed_count > 0 && (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space size={28} wrap>
            <Statistic
              title="Hard score"
              value={data.hard_score ?? 0}
              precision={3}
              valueStyle={{ color: (data.hard_score ?? 0) >= 1 ? '#dc2626' : (data.hard_score ?? 0) >= 0.5 ? '#d97706' : undefined }}
            />
            <Statistic title="Mean loss" value={data.mean_loss ?? 0} precision={3} />
            <Statistic title="Max loss" value={data.max_loss ?? 0} precision={3} />
            <Statistic title="Consumed" value={data.consumed_count} />
            <Statistic title="Train runs" value={data.train_run_count} />
            <Statistic title="Snapshots" value={data.snapshot_count} />
          </Space>

          <div>
            <Text strong>Identifiers</Text>
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical" size={4}>
                <span>
                  <Text type="secondary" style={{ marginRight: 8 }}>Dataset:</Text>
                  {data.dataset_id ? (
                    <Link to={`/catalog/v2/${encodeURIComponent(data.dataset_id)}`}>
                      <IdCell value={data.dataset_id} variant="full" />
                    </Link>
                  ) : <Text type="secondary">—</Text>}
                </span>
                <span>
                  <Text type="secondary" style={{ marginRight: 8 }}>Clip:</Text>
                  {data.clip_id ? (
                    <Link to={`/explorer/clips/${encodeURIComponent(data.clip_id)}`}>
                      <IdCell value={data.clip_id} variant="full" />
                    </Link>
                  ) : <Text type="secondary">—</Text>}
                </span>
              </Space>
            </div>
          </div>

          <div>
            <Text strong>Snapshots ({data.snapshot_traces.length})</Text>
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical" size={4}>
                {data.snapshot_traces.map((t) => <IdCell key={t} value={t} variant="full" />)}
              </Space>
            </div>
          </div>

          <div>
            <Text strong>Loss timeline ({data.events.length} events)</Text>
            <Table<EventRow>
              className="app-data-table"
              style={{ marginTop: 12 }}
              rowKey={(r, i) => `${r.train_run_id}-${i}`}
              size="small"
              columns={eventColumns}
              dataSource={data.events}
              pagination={{ pageSize: 50, showSizeChanger: false }}
              scroll={{ x: 760 }}
            />
          </div>

          <Tag color="blue">P3：曲线图 + influence-fn 待补</Tag>
        </Space>
      )}
    </Drawer>
  )
}
