import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Progress, Row, Space, Table, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { StatCard } from '@/shared/components/stat-card'
import { TableCellText } from '@/shared/components/table-cell-text'
import type { CostStats } from '../api'
import { fetchCostStats } from '../api'

const { Text, Title } = Typography

function fmtUsd(v: number): string {
  if (!isFinite(v)) return '—'
  if (v >= 100) return `$${v.toFixed(2)}`
  if (v >= 1) return `$${v.toFixed(3)}`
  return `$${v.toFixed(4)}`
}

function fmtHours(seconds: number): string {
  if (!seconds) return '0h'
  const h = seconds / 3600
  if (h >= 1) return `${h.toFixed(2)}h`
  const m = seconds / 60
  if (m >= 1) return `${m.toFixed(1)}m`
  return `${seconds.toFixed(1)}s`
}

function fmtGb(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  return `${(gb * 1024).toFixed(1)} MB`
}

function BarList({
  rows,
  labelKey,
  valueKey,
  max,
  linkBuilder,
  labelWidth = 200,
}: {
  rows: Array<Record<string, unknown>>
  labelKey: string
  valueKey: string
  max: number
  linkBuilder?: (row: Record<string, unknown>) => string | null
  labelWidth?: number
}) {
  if (rows.length === 0) return <Text type="secondary">暂无数据</Text>
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {rows.map((row, idx) => {
        const label = String(row[labelKey] ?? '—')
        const value = Number(row[valueKey] ?? 0)
        const pct = max > 0 ? Math.round((value / max) * 100) : 0
        const href = linkBuilder?.(row)
        const labelNode = href ? <Link to={href}>{label}</Link> : <Text strong>{label}</Text>
        return (
          <div key={`${label}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: labelWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelNode}</div>
            <Progress
              percent={pct}
              showInfo={false}
              strokeColor={{ from: '#2175ff', to: '#4f9bff' }}
              style={{ flex: 1, margin: 0 }}
            />
            <Text type="secondary" style={{ width: 90, textAlign: 'right' }}>{fmtUsd(value)}</Text>
          </div>
        )
      })}
    </Space>
  )
}

export function CostView() {
  const [data, setData] = useState<CostStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchCostStats()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const reqMax = data?.by_requirement[0]?.cost_usd ?? 0
  const pipelineMax = data?.by_pipeline[0]?.cost_usd ?? 0
  const stageMax = data?.by_stage[0]?.cost_usd ?? 0
  const purposeMax = data?.by_run_purpose[0]?.cost_usd ?? 0

  const reqColumns: ColumnsType<CostStats['by_requirement'][number]> = [
    { key: 'title', title: 'Requirement', dataIndex: 'title', width: 240,
      render: (t: string, row) => (
        <Link to={`/requirements/${row.requirement_id}`}>
          <TableCellText value={t} maxWidth={240} />
        </Link>
      ) },
    { key: 'requirement_id', title: 'ID', dataIndex: 'requirement_id', width: 220,
      render: (v: string) => <TableCellText value={v} maxWidth={220} code /> },
    { key: 'cost_usd', title: 'Cost', dataIndex: 'cost_usd', width: 120, align: 'right',
      render: (v: number) => <Text strong>{fmtUsd(v)}</Text> },
    {
      key: 'pct',
      title: 'Share',
      dataIndex: 'cost_usd',
      width: 220,
      render: (v: number) => {
        const total = data?.totals.cost_usd ?? 0
        const pct = total > 0 ? Math.round((v / total) * 100) : 0
        return <Progress percent={pct} size="small" />
      },
    },
    {
      key: 'actions',
      title: '',
      dataIndex: 'requirement_id',
      width: 160,
      render: (rid: string) => (
        <Link to={`/pipelines?tab=runs&requirement_id=${encodeURIComponent(rid)}`}>
          <Button type="link" size="small">View runs →</Button>
        </Link>
      ),
    },
  ]

  return (
    <>
      {error && <Alert type="error" showIcon message="Failed to load cost stats" description={error} style={{ marginBottom: 16 }} />}

      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        <Col flex="1"><StatCard label="Total cost" value={data ? fmtUsd(data.totals.cost_usd) : '—'} /></Col>
        <Col flex="1"><StatCard label="Runs" value={data?.total_runs ?? '—'} /></Col>
        <Col flex="1"><StatCard label="CPU time" value={data ? fmtHours(data.totals.cpu_seconds) : '—'} /></Col>
        <Col flex="1"><StatCard label="GPU time" value={data ? fmtHours(data.totals.gpu_seconds) : '—'} /></Col>
        <Col flex="1"><StatCard label="Storage" value={data ? fmtGb(data.totals.storage_gb) : '—'} /></Col>
        <Col flex="1"><StatCard label="Wall time" value={data ? fmtHours(data.totals.duration_seconds) : '—'} /></Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Cost by requirement</Title>}
        extra={<Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>Refresh</Button>}
        style={{ marginBottom: 16 }}
      >
        <Table<CostStats['by_requirement'][number]>
          className="app-data-table"
          columns={reqColumns}
          dataSource={data?.by_requirement ?? []}
          rowKey={(r) => r.requirement_id}
          size="small"
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
          locale={{ emptyText: '暂无需求归因数据' }}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<Title level={5} style={{ margin: 0 }}>By pipeline</Title>}>
            <BarList
              rows={(data?.by_pipeline ?? []) as unknown as Array<Record<string, unknown>>}
              labelKey="pipeline_name"
              valueKey="cost_usd"
              max={pipelineMax}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Title level={5} style={{ margin: 0 }}>By stage</Title>}>
            <BarList
              rows={(data?.by_stage ?? []) as unknown as Array<Record<string, unknown>>}
              labelKey="stage"
              valueKey="cost_usd"
              max={stageMax}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Title level={5} style={{ margin: 0 }}>By run purpose</Title>}>
            <BarList
              rows={(data?.by_run_purpose ?? []) as unknown as Array<Record<string, unknown>>}
              labelKey="run_purpose"
              valueKey="cost_usd"
              max={purposeMax}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Title level={5} style={{ margin: 0 }}>Top requirements (bar)</Title>}>
            <BarList
              rows={(data?.by_requirement ?? []).slice(0, 10) as unknown as Array<Record<string, unknown>>}
              labelKey="title"
              valueKey="cost_usd"
              max={reqMax}
              labelWidth={220}
              linkBuilder={(row) => `/requirements/${row.requirement_id}`}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
