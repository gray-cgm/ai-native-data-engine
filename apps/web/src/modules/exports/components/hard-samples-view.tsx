import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { ExperimentOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { IdCell } from '@/shared/components/id-cell'
import { fetchContributions, type HardSampleRow } from '../api'
import { ContributionDrawer } from './contribution.drawer'

const { Text } = Typography

function HardScoreTag({ score }: { score: number }) {
  const color = score >= 1.0 ? 'red' : score >= 0.5 ? 'orange' : 'default'
  return <Tag color={color}>{score.toFixed(3)}</Tag>
}

export function HardSamplesView() {
  const navigate = useNavigate()
  const [datasetFilter, setDatasetFilter] = useState('')
  const [rows, setRows] = useState<HardSampleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetchContributions({ dataset_id: datasetFilter || undefined, limit: 100 })
      .then((res) => setRows(res.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [datasetFilter])

  useEffect(() => { load() }, [load])

  const sendToMining = useCallback((row: HardSampleRow) => {
    // MVP：跳到 Mining 创建页面，预填 query；P3 改成自动 create + parent_trace_id
    const params = new URLSearchParams()
    if (row.clip_id) params.set('q', row.clip_id)
    if (row.dataset_id) params.set('dataset', row.dataset_id)
    params.set('source', 'hard-sample')
    params.set('hard_score', row.hard_score.toFixed(3))
    navigate(`/ops/mining?${params.toString()}`)
  }, [navigate])

  const columns: ColumnsType<HardSampleRow> = useMemo(() => [
    { key: 'rank', title: '#', width: 50, align: 'right' as const,
      render: (_: unknown, _row, idx) => <Text type="secondary">{idx + 1}</Text> },
    { key: 'hard_score', title: 'Hard score', dataIndex: 'hard_score', width: 110,
      render: (v: number) => <HardScoreTag score={v} /> },
    { key: 'mean_loss', title: 'Mean loss', dataIndex: 'mean_loss', width: 90, align: 'right' as const,
      render: (v: number) => v.toFixed(3) },
    { key: 'consumed_count', title: 'Consumed', dataIndex: 'consumed_count', width: 90, align: 'right' as const },
    { key: 'train_run_count', title: 'Runs', dataIndex: 'train_run_count', width: 70, align: 'right' as const },
    { key: 'sample_uid', title: 'Sample', dataIndex: 'sample_uid', width: 280,
      render: (t: string) => <IdCell value={t} variant="mono-ellipsis" maxWidth={240} /> },
    { key: 'dataset_id', title: 'Dataset', dataIndex: 'dataset_id', width: 160,
      render: (t: string | null) => <IdCell value={t} /> },
    { key: 'clip_id', title: 'Clip', dataIndex: 'clip_id', width: 160,
      render: (t: string | null) => <IdCell value={t} /> },
    { key: 'last_used_at', title: 'Last used', dataIndex: 'last_used_at', width: 170,
      render: (t: string | null) => <Text type="secondary">{t ? new Date(t).toLocaleString() : '—'}</Text> },
    { key: '_actions', title: '', width: 130, fixed: 'right' as const,
      render: (_: unknown, row) => (
        <span data-stop-row-click>
          <Tooltip title="Create / track mining set for this hard sample">
            <Button size="small" icon={<SendOutlined />} onClick={() => sendToMining(row)}>
              Send to Mining
            </Button>
          </Tooltip>
        </span>
      ),
    },
  ], [sendToMining])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space>
          <Input
            placeholder="Filter by dataset_id"
            allowClear
            style={{ width: 280 }}
            value={datasetFilter}
            onChange={(e) => setDatasetFilter(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ExperimentOutlined /> hard_score = mean_loss × log(1 + consumed_count)
          </Text>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} />}

      {rows.length === 0 && !loading ? (
        <Empty description="还没有带 loss 的消费事件。算工调 dlkit.LossLogger(run).log(sample_uids, losses) 后这里就会有数据。" />
      ) : (
        <Table<HardSampleRow>
          className="app-data-table"
          rowKey="sample_uid"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          rowClassName={(row) =>
            'clickable-row' + (row.sample_uid === selectedUid ? ' clickable-row--selected' : '')
          }
          onRow={(row) => ({
            onClick: (event) => {
              const target = event.target as HTMLElement
              if (target.closest('a, button, [data-stop-row-click]')) return
              setSelectedUid(row.sample_uid)
            },
            tabIndex: 0,
            onKeyDown: (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              setSelectedUid(row.sample_uid)
            },
          })}
          scroll={{ x: 1400 }}
        />
      )}

      <ContributionDrawer
        sampleUid={selectedUid}
        onClose={() => setSelectedUid(null)}
      />
    </Space>
  )
}
