import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatCard } from '@/shared/components/stat-card'
import type { QualityStats } from '../api'
import { fetchQualityStats } from '../api'

const { Text, Title } = Typography

const GATE_COLOR: Record<string, string> = {
  pass: '#52c41a',
  waiver: '#faad14',
  block: '#ff4d4f',
  unknown: '#8c8c8c',
}
const GATE_LABEL: Record<string, string> = {
  pass: 'Pass',
  waiver: 'Waiver',
  block: 'Block',
  unknown: 'Unknown',
}

type BreakdownRow = {
  key: string
  group: string
  pass: number
  waiver: number
  block: number
  unknown: number
  total: number
  pass_rate: number
}

function toBreakdown(map: Record<string, Record<string, number>>): BreakdownRow[] {
  return Object.entries(map).map(([group, counts]) => {
    const pass = counts.pass ?? 0
    const waiver = counts.waiver ?? 0
    const block = counts.block ?? 0
    const unknown = counts.unknown ?? 0
    const total = pass + waiver + block + unknown
    return {
      key: group,
      group,
      pass,
      waiver,
      block,
      unknown,
      total,
      pass_rate: total > 0 ? (pass / total) * 100 : 0,
    }
  }).sort((a, b) => b.total - a.total)
}

export function QualityView() {
  const [data, setData] = useState<QualityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchQualityStats()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const purposeRows = useMemo(() => (data ? toBreakdown(data.by_run_purpose) : []), [data])
  const stageRows = useMemo(() => (data ? toBreakdown(data.by_stage) : []), [data])

  const breakdownColumns: ColumnsType<BreakdownRow> = [
    { key: 'group', title: 'Group', dataIndex: 'group', width: 180, render: (g: string) => <Tag>{g}</Tag> },
    { key: 'pass', title: 'Pass', dataIndex: 'pass', width: 90, align: 'right' },
    { key: 'waiver', title: 'Waiver', dataIndex: 'waiver', width: 90, align: 'right' },
    { key: 'block', title: 'Block', dataIndex: 'block', width: 90, align: 'right' },
    { key: 'unknown', title: 'Unknown', dataIndex: 'unknown', width: 100, align: 'right' },
    { key: 'total', title: 'Total', dataIndex: 'total', width: 90, align: 'right' },
    {
      key: 'pass_rate',
      title: 'Pass rate',
      dataIndex: 'pass_rate',
      width: 220,
      render: (v: number) => (
        <Progress
          percent={Math.round(v)}
          size="small"
          strokeColor={v >= 80 ? '#52c41a' : v >= 50 ? '#faad14' : '#ff4d4f'}
        />
      ),
    },
  ]

  const maxReason = data && data.top_failure_reasons.length > 0 ? data.top_failure_reasons[0].count : 0

  const gateEntries = useMemo(() => {
    if (!data) return [] as Array<[string, number]>
    const order = ['pass', 'waiver', 'block', 'unknown']
    return order
      .map((k) => [k, data.by_gate_result[k] ?? 0] as [string, number])
      .filter(([, v]) => v > 0)
  }, [data])

  return (
    <>
      {error && <Alert type="error" showIcon message="Failed to load quality stats" description={error} style={{ marginBottom: 16 }} />}

      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col flex="1"><StatCard label="Total runs" value={data?.total_runs ?? '—'} /></Col>
        <Col flex="1"><StatCard label="With metrics" value={data?.total_with_metrics ?? '—'} /></Col>
        <Col flex="1"><StatCard label="Pass rate" value={data ? `${data.pass_rate}%` : '—'} /></Col>
        <Col flex="1"><StatCard label="Pass" value={data?.by_gate_result.pass ?? '—'} /></Col>
        <Col flex="1"><StatCard label="Waiver" value={data?.by_gate_result.waiver ?? '—'} /></Col>
        <Col flex="1"><StatCard label="Block" value={data?.by_gate_result.block ?? '—'} /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Gate result distribution</Title>}
            extra={<Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>Refresh</Button>}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {gateEntries.length === 0 && <Text type="secondary">暂无数据。</Text>}
              {gateEntries.map(([k, v]) => {
                const total = data?.total_runs || 1
                const pct = Math.round((v / total) * 100)
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Text strong style={{ width: 80 }}>{GATE_LABEL[k] ?? k}</Text>
                    <Progress
                      percent={pct}
                      showInfo={false}
                      strokeColor={GATE_COLOR[k] ?? '#8c8c8c'}
                      style={{ flex: 1, margin: 0 }}
                    />
                    <Text type="secondary" style={{ width: 70, textAlign: 'right' }}>{v} ({pct}%)</Text>
                  </div>
                )
              })}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title={<Title level={5} style={{ margin: 0 }}>Top failure reasons</Title>}>
            {data && data.top_failure_reasons.length === 0 && (
              <Text type="secondary">暂无失败原因记录。</Text>
            )}
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {data?.top_failure_reasons.map((r) => (
                <div key={r.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text strong style={{ width: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</Text>
                  <Progress
                    percent={maxReason > 0 ? Math.round((r.count / maxReason) * 100) : 0}
                    showInfo={false}
                    strokeColor="#ff4d4f"
                    style={{ flex: 1, margin: 0 }}
                  />
                  <Text type="secondary" style={{ width: 50, textAlign: 'right' }}>{r.count}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<Title level={5} style={{ margin: 0 }}>By run purpose</Title>}>
            <Table<BreakdownRow>
              className="app-data-table"
              columns={breakdownColumns}
              dataSource={purposeRows}
              rowKey="key"
              size="small"
              tableLayout="fixed"
              scroll={{ x: 'max-content' }}
              pagination={false}
              locale={{ emptyText: '暂无数据' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Title level={5} style={{ margin: 0 }}>By stage</Title>}>
            <Table<BreakdownRow>
              className="app-data-table"
              columns={breakdownColumns}
              dataSource={stageRows}
              rowKey="key"
              size="small"
              tableLayout="fixed"
              scroll={{ x: 'max-content' }}
              pagination={false}
              locale={{ emptyText: '暂无数据' }}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
