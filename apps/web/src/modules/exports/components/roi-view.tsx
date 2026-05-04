import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { IdCell } from '@/shared/components/id-cell'
import { fetchContributionsRollup, type DatasetRollupRow } from '../api'

const { Text } = Typography

export function RoiView() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DatasetRollupRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetchContributionsRollup()
      .then((res) => setRows(res.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const columns: ColumnsType<DatasetRollupRow> = useMemo(() => [
    { key: 'dataset_id', title: 'Dataset', dataIndex: 'dataset_id', width: 220,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={190} /> },
    { key: 'sample_count', title: 'Samples', dataIndex: 'sample_count', width: 90, align: 'right' as const },
    { key: 'consumed_count', title: 'Consumed', dataIndex: 'consumed_count', width: 100, align: 'right' as const,
      render: (n: number) => n.toLocaleString() },
    { key: 'train_run_count', title: 'Runs', dataIndex: 'train_run_count', width: 70, align: 'right' as const },
    { key: 'snapshot_count', title: 'Snapshots', dataIndex: 'snapshot_count', width: 90, align: 'right' as const },
    { key: 'mean_loss', title: 'Mean loss', dataIndex: 'mean_loss', width: 100, align: 'right' as const,
      render: (v: number | null) => v == null ? <Text type="secondary">—</Text> : v.toFixed(3) },
    { key: 'hard_sample_count', title: 'Hard', dataIndex: 'hard_sample_count', width: 80, align: 'right' as const },
    { key: 'hard_ratio', title: 'Hard %', dataIndex: 'hard_ratio', width: 100,
      render: (v: number) => {
        const pct = (v * 100).toFixed(1)
        const color = v >= 0.3 ? 'red' : v >= 0.1 ? 'orange' : 'default'
        return <Tag color={color}>{pct}%</Tag>
      },
    },
  ], [])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Live aggregation; 仅含已上报 loss 的 sample 进入 mean_loss / hard 统计。
            点行进 dataset 详情。
          </Text>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} />}

      {rows.length === 0 && !loading ? (
        <Empty description="暂无 ROI 数据。等 train_run 上报消费事件后，这里按 dataset 维度聚合。" />
      ) : (
        <Table<DatasetRollupRow>
          className="app-data-table"
          rowKey="dataset_id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowClassName="clickable-row"
          onRow={(row) => ({
            onClick: (event) => {
              const target = event.target as HTMLElement
              if (target.closest('a, button, [data-stop-row-click]')) return
              navigate(`/catalog/v2/${encodeURIComponent(row.dataset_id)}?tab=training-impact`)
            },
            tabIndex: 0,
            onKeyDown: (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              navigate(`/catalog/v2/${encodeURIComponent(row.dataset_id)}?tab=training-impact`)
            },
          })}
          scroll={{ x: 900 }}
        />
      )}
    </Space>
  )
}
