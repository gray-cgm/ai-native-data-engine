import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useSearchParams } from 'react-router-dom'
import { MermaidBlock } from '@/modules/docs/components/mermaid-block'
import { StatusBadge } from '@/shared/components/status-badge'
import { TableCellText } from '@/shared/components/table-cell-text'
import { fetchRecentTraces, fetchTraceChain, type TraceChain, type TraceSummary } from '../api'
import { RunDetailDrawer } from './run-detail.drawer'

const { Text, Title } = Typography

function safeId(raw: string | null | undefined): string {
  if (!raw) return 'none'
  return raw.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32) || 'node'
}

function truncate(s: string | null | undefined, n = 18): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

function buildMermaid(chain: TraceChain): string {
  const lines: string[] = ['graph LR']
  const edges = new Set<string>()

  for (const r of chain.requirements) {
    const id = `req_${safeId(String(r.id))}`
    const label = truncate(String(r.title ?? r.id), 24)
    lines.push(`  ${id}["<b>REQ</b><br/>${label}"]:::req`)
  }
  for (const d of chain.data_tasks) {
    const id = `dt_${safeId(String(d.id))}`
    const label = truncate(String(d.title ?? d.id), 24)
    lines.push(`  ${id}["<b>DT</b> · ${d.task_type ?? ''}<br/>${label}"]:::dt`)
    if (d.requirement_id) {
      const k = `req_${safeId(String(d.requirement_id))} --> ${id}`
      if (!edges.has(k)) { edges.add(k); lines.push(`  ${k}`) }
    }
  }
  for (const o of chain.operations_tasks) {
    const id = `ops_${safeId(String(o.id))}`
    const label = truncate(String(o.title ?? o.id), 22)
    lines.push(`  ${id}("<b>OPS</b> · ${o.module ?? ''}<br/>${label}"):::ops`)
    if (o.data_task_id) {
      const k = `dt_${safeId(String(o.data_task_id))} --> ${id}`
      if (!edges.has(k)) { edges.add(k); lines.push(`  ${k}`) }
    }
  }
  for (const p of chain.pipeline_runs) {
    const id = `run_${safeId(String(p.id))}`
    const label = truncate(String(p.pipeline_name ?? p.id), 22)
    const cls = p.status === 'failed' ? 'runF' : p.status === 'success' ? 'runS' : 'run'
    lines.push(`  ${id}[["<b>RUN</b> · ${p.stage ?? ''}<br/>${label}"]]:::${cls}`)
    if (p.operations_task_id) {
      const k = `ops_${safeId(String(p.operations_task_id))} --> ${id}`
      if (!edges.has(k)) { edges.add(k); lines.push(`  ${k}`) }
    } else if (p.data_task_id) {
      const k = `dt_${safeId(String(p.data_task_id))} --> ${id}`
      if (!edges.has(k)) { edges.add(k); lines.push(`  ${k}`) }
    }
    if (p.trace_parent_id && p.trace_parent_id !== p.operations_task_id) {
      const parent = `run_${safeId(String(p.trace_parent_id))}`
      const k = `${parent} -.-> ${id}`
      if (!edges.has(k)) { edges.add(k); lines.push(`  ${k}`) }
    }
  }

  lines.push('  classDef req fill:#f0e6ff,stroke:#7c4dff,color:#3b1e8c;')
  lines.push('  classDef dt fill:#e6f0ff,stroke:#2175ff,color:#0b3782;')
  lines.push('  classDef ops fill:#e6faff,stroke:#13c2c2,color:#00474f;')
  lines.push('  classDef run fill:#f6ffed,stroke:#52c41a,color:#135200;')
  lines.push('  classDef runS fill:#d9f7be,stroke:#389e0d,color:#135200;')
  lines.push('  classDef runF fill:#fff1f0,stroke:#cf1322,color:#820014;')
  return lines.join('\n')
}

export function LineageView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTrace = searchParams.get('x_trace_id') ?? searchParams.get('trace') ?? ''
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selected, setSelected] = useState<string | null>(initialTrace || null)
  const [chain, setChain] = useState<TraceChain | null>(null)
  const [loadingChain, setLoadingChain] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const loadTraces = useCallback(() => {
    setLoadingList(true)
    fetchRecentTraces(50)
      .then((items) => {
        setTraces(items)
        if (!selected && items.length > 0) {
          setSelected(items[0].x_trace_id)
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingList(false))
  }, [selected])

  useEffect(() => { loadTraces() }, [loadTraces])

  useEffect(() => {
    if (!selected) return
    setLoadingChain(true)
    setError(null)
    fetchTraceChain(selected)
      .then((c) => setChain(c))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingChain(false))
  }, [selected])

  const mermaidCode = useMemo(() => (chain ? buildMermaid(chain) : ''), [chain])

  const runColumns: ColumnsType<Record<string, unknown>> = useMemo(() => [
    { key: 'pipeline_name', title: 'Pipeline', dataIndex: 'pipeline_name', width: 180,
      render: (t) => <TableCellText value={String(t ?? '')} maxWidth={180} /> },
    { key: 'stage', title: 'Stage', dataIndex: 'stage', width: 150,
      render: (t) => <Tag>{String(t ?? '')}</Tag> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 110,
      render: (s) => <StatusBadge status={String(s ?? '')} /> },
    { key: 'trigger_source', title: 'Trigger', dataIndex: 'trigger_source', width: 130,
      render: (s) => <Tag color="orange">{String(s ?? '')}</Tag> },
    { key: 'run_purpose', title: 'Purpose', dataIndex: 'run_purpose', width: 120,
      render: (s) => <Tag color="magenta">{String(s ?? '')}</Tag> },
    { key: 'id', title: 'Run ID', dataIndex: 'id', width: 220,
      render: (v) => <TableCellText value={String(v ?? '')} maxWidth={220} code /> },
  ], [])

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={[10, 10]} align="center">
          <Text strong>Trace：</Text>
          <Select
            showSearch
            allowClear
            placeholder="选择 x_trace_id 或直接输入"
            style={{ minWidth: 420 }}
            value={selected ?? undefined}
            loading={loadingList}
            onChange={(v) => {
              setSelected(v ?? null)
              const next = new URLSearchParams(searchParams)
              if (v) next.set('x_trace_id', v)
              else next.delete('x_trace_id')
              setSearchParams(next, { replace: true })
            }}
            filterOption={(input, option) => {
              const t = String(option?.value ?? '').toLowerCase()
              const l = String(option?.label ?? '').toLowerCase()
              return t.includes(input.toLowerCase()) || l.includes(input.toLowerCase())
            }}
            options={traces.map((t) => ({
              value: t.x_trace_id,
              label: `${t.x_trace_id.slice(0, 12)}…  ·  ${t.requirement_title ?? '—'}  ·  ${t.run_count} runs`,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadTraces}>Reload traces</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {traces.length} 条最近 trace</Text>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message="Failed to load trace chain" description={error} style={{ marginBottom: 16 }} />}

      {!selected && (
        <Empty description="请选择一个 x_trace_id 以查看全链路血缘 DAG" />
      )}

      {selected && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card
              title={<Title level={5} style={{ margin: 0 }}>Trace DAG</Title>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Requirement → DataTask → OperationsTask → Run</Text>}
            >
              {loadingChain && <Spin />}
              {!loadingChain && chain && mermaidCode && (
                <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                  <MermaidBlock code={mermaidCode} />
                </div>
              )}
              {!loadingChain && chain && !mermaidCode && (
                <Empty description="该 trace 尚无可视化节点" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title={<Title level={5} style={{ margin: 0 }}>Trace Summary</Title>}>
              {!chain && loadingChain && <Spin />}
              {chain && (
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="x_trace_id"><Text code>{chain.x_trace_id}</Text></Descriptions.Item>
                  <Descriptions.Item label="Requirements">{chain.requirements.length}</Descriptions.Item>
                  <Descriptions.Item label="Data Tasks">{chain.data_tasks.length}</Descriptions.Item>
                  <Descriptions.Item label="Operations Tasks">{chain.operations_tasks.length}</Descriptions.Item>
                  <Descriptions.Item label="Pipeline Runs">{chain.pipeline_runs.length}</Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Col>
          <Col xs={24}>
            <Card title={<Title level={5} style={{ margin: 0 }}>Runs in this trace</Title>}>
              <Table<Record<string, unknown>>
                className="app-data-table"
                columns={runColumns}
                dataSource={chain?.pipeline_runs ?? []}
                rowKey={(r) => String(r.id)}
                size="small"
                tableLayout="fixed"
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
                onRow={(record) => ({ onClick: () => setSelectedRunId(String(record.id)), style: { cursor: 'pointer' } })}
                locale={{ emptyText: '暂无 Pipeline Run' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <RunDetailDrawer
        runId={selectedRunId}
        open={!!selectedRunId}
        onClose={() => setSelectedRunId(null)}
      />
    </>
  )
}
