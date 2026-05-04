import { useEffect, useState } from 'react'
import { Alert, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { fetchContributions, fetchContributionsRollup, type DatasetRollupRow, type HardSampleRow } from '../api'

const { Text } = Typography

interface Props {
  datasetId: string
}

/** Embedded section for catalog dataset detail. Calls the same /contributions
 *  endpoints filtered by dataset_id. Empty state is fine — most datasets won't
 *  have training feedback until SDK is integrated. */
export function TrainingImpactSection({ datasetId }: Props) {
  const [rollup, setRollup] = useState<DatasetRollupRow | null>(null)
  const [topHard, setTopHard] = useState<HardSampleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    Promise.all([
      fetchContributionsRollup({ dataset_id: datasetId }),
      fetchContributions({ dataset_id: datasetId, limit: 5 }),
    ])
      .then(([r, h]) => {
        if (cancelled) return
        setRollup(r.items[0] ?? null)
        setTopHard(h.items)
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [datasetId])

  if (error) {
    return <Alert type="error" showIcon message={error} />
  }

  if (loading) {
    return <Card title="Training Impact" loading />
  }

  if (!rollup || rollup.consumed_count === 0) {
    return (
      <Card title="Training Impact">
        <Empty
          description={
            <Text type="secondary">
              此 dataset 尚未被任何 train_run 上报消费。等算工调用 dlkit SDK
              （<code>dlkit.run(snapshot_traces=[...])</code>）后这里会出 ROI 统计。
              {' '}
              <Link to={`/exports?tab=consumers`}>查看 Consumers</Link>
            </Text>
          }
        />
      </Card>
    )
  }

  return (
    <Card
      title="Training Impact"
      extra={<Link to={`/exports?tab=hard-samples`}>Open in Exports →</Link>}
    >
      <Row gutter={16}>
        <Col span={4}><Statistic title="Snapshots" value={rollup.snapshot_count} /></Col>
        <Col span={4}><Statistic title="Train runs" value={rollup.train_run_count} /></Col>
        <Col span={4}>
          <Statistic title="Consumed" value={rollup.consumed_count}
                     formatter={(v) => Number(v).toLocaleString()} />
        </Col>
        <Col span={4}>
          <Statistic title="Mean loss"
                     value={rollup.mean_loss ?? 0}
                     precision={3}
                     valueStyle={(rollup.mean_loss ?? 0) >= 0.5 ? { color: '#d97706' } : undefined} />
        </Col>
        <Col span={4}>
          <Statistic title="Hard samples"
                     value={rollup.hard_sample_count}
                     suffix={`/ ${rollup.sample_count}`} />
        </Col>
        <Col span={4}>
          <Statistic title="Hard %"
                     value={(rollup.hard_ratio * 100)}
                     precision={1}
                     suffix="%"
                     valueStyle={rollup.hard_ratio >= 0.3 ? { color: '#dc2626' } : undefined} />
        </Col>
      </Row>

      {topHard.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Text strong>Top {topHard.length} hard samples in this dataset</Text>
          <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
            {topHard.map((row) => (
              <Link
                key={row.sample_uid}
                to={`/exports?tab=contributions&sample_uid=${encodeURIComponent(row.sample_uid)}`}
                style={{ display: 'block' }}
              >
                <Space size={12}>
                  <Tag color={row.hard_score >= 1 ? 'red' : row.hard_score >= 0.5 ? 'orange' : 'default'}>
                    {row.hard_score.toFixed(3)}
                  </Tag>
                  <Text code style={{ fontSize: 12 }}>{row.clip_id}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    mean_loss={row.mean_loss.toFixed(3)} · consumed={row.consumed_count} · runs={row.train_run_count}
                  </Text>
                </Space>
              </Link>
            ))}
          </Space>
        </div>
      )}
    </Card>
  )
}
